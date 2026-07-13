#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(resolve(root, 'benchmarks/config.json'), 'utf8'));

function usage() {
  console.log(`Usage: node scripts/run-benchmark.mjs [options]

Options:
  --mode smoke|primary|extended  Benchmark size (default: smoke)
  --output PATH                  Result JSON path
  --database-url URL             Local Postgres URL (or set DATABASE_URL)
  --help                         Show this help

Remote hosts are refused unless ALLOW_REMOTE_BENCHMARK=1 is set.`);
}

function parseArgs(argv) {
  const args = { mode: 'smoke' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help') return { help: true };
    if (value === '--mode' || value === '--output' || value === '--database-url') {
      const next = argv[index + 1];
      if (!next) throw new Error(`${value} requires a value`);
      args[value.slice(2).replace('-url', 'Url')] = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function assertSafeDatabase(databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Benchmark database URL must use postgres:// or postgresql://');
  }
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
  if (!localHosts.has(parsed.hostname) && process.env.ALLOW_REMOTE_BENCHMARK !== '1') {
    throw new Error(`Refusing destructive benchmark against non-local host ${parsed.hostname}. Set ALLOW_REMOTE_BENCHMARK=1 only for an isolated benchmark database.`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} exited ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout.trim();
}

function psql(databaseUrl, extraArgs) {
  return run('psql', [
    '--no-psqlrc',
    '--set', 'ON_ERROR_STOP=1',
    '--tuples-only',
    '--no-align',
    '--quiet',
    '--dbname', databaseUrl,
    ...extraArgs,
  ]);
}

function elapsedMs(start) {
  return Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} did not return valid JSON: ${value.slice(0, 300)}`);
  }
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const modeConfig = config.modes[args.mode];
if (!modeConfig) throw new Error(`Unsupported mode ${args.mode}; expected smoke, primary, or extended`);
if (modeConfig.premiumRows + modeConfig.claimRows !== modeConfig.totalRows) {
  throw new Error(`Invalid ${args.mode} configuration: component rows do not equal totalRows`);
}

const databaseUrl = args.databaseUrl ?? process.env.DATABASE_URL ?? config.databaseUrl;
assertSafeDatabase(databaseUrl);

const output = resolve(root, args.output ?? `benchmarks/results/${args.mode}-latest.json`);
const commonVars = [
  '--set', `mode=${args.mode}`,
  '--set', `seed=${config.seed}`,
  '--set', `premium_rows=${modeConfig.premiumRows}`,
  '--set', `claim_rows=${modeConfig.claimRows}`,
  '--set', `total_rows=${modeConfig.totalRows}`,
  '--set', `query_samples=${modeConfig.querySamples}`,
  '--set', `from_date=${config.window.from}`,
  '--set', `to_date=${config.window.to}`,
];

const totalStart = process.hrtime.bigint();
const seedStart = process.hrtime.bigint();
psql(databaseUrl, [...commonVars, '--file', resolve(root, 'benchmarks/sql/prepare-source.sql')]);
const seedMs = elapsedMs(seedStart);

const watermarksBefore = parseJson(psql(databaseUrl, [
  '--command', `select coalesce(jsonb_agg(jsonb_build_object(
    'sourceName', source_name,
    'watermarkTs', watermark_ts,
    'watermarkSourceId', watermark_source_id,
    'lastSuccessfulRunId', last_successful_run_id
  ) order by source_name), '[]'::jsonb)::text from ops.etl_watermarks;`,
]), 'pre-backfill watermarks');

const pipelineStart = process.hrtime.bigint();
const pipelineResponse = parseJson(psql(databaseUrl, [
  '--command', `select public.run_demo_backfill('${config.window.from}'::date, '${config.window.to}'::date)::text;`,
]), 'run_demo_backfill');
const pipelineMs = elapsedMs(pipelineStart);

const runId = pipelineResponse.run_id ?? pipelineResponse.runId ?? null;
const safeRunId = typeof runId === 'string' && /^[0-9a-f-]{36}$/i.test(runId) ? runId : null;
const summarySql = `
with selected_run as (
  select * from public.pipeline_runs
  where ${safeRunId ? `run_id = '${safeRunId}'::uuid` : 'true'}
  order by started_at desc
  limit 1
), quality as (
  select
    count(*) filter (where d.status = 'pass')::integer as passed,
    count(*)::integer as total,
    count(*) filter (where d.status <> 'pass')::integer as failed
  from public.dq_results d
  join selected_run r on d.pipeline_run_id = r.run_id
)
select jsonb_build_object(
  'postgresVersion', current_setting('server_version'),
  'runId', (select run_id from selected_run),
  'status', (select status from selected_run),
  'sourceRows', coalesce((select source_rows from selected_run), 0),
  'insertedRows', coalesce((select inserted_rows from selected_run), 0),
  'updatedRows', coalesce((select updated_rows from selected_run), 0),
  'unchangedRows', coalesce((select unchanged_rows from selected_run), 0),
  'recalculatedRows', coalesce((select recalculated_rows from selected_run), 0),
  'rejectedRows', coalesce((select rejected_rows from selected_run), 0),
  'stagedPremium', (select count(*)::integer from staging.raw_premium_txn),
  'stagedClaims', (select count(*)::integer from staging.raw_claim_txn),
  'premiumFacts', (select count(*)::integer from public.fact_premium),
  'lossFacts', (select count(*)::integer from public.fact_loss),
  'stageRuns', (select count(*)::integer from ops.pipeline_stage_runs s join selected_run r on s.run_id = r.run_id),
  'stageDurations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'order', s.stage_order,
      'name', s.stage_name,
      'status', s.status,
      'durationMs', s.duration_ms,
      'inputRows', s.input_rows,
      'insertedRows', s.inserted_rows,
      'updatedRows', s.updated_rows,
      'unchangedRows', s.unchanged_rows,
      'recalculatedRows', s.recalculated_rows,
      'rejectedRows', s.rejected_rows
    ) order by s.stage_order)
    from ops.pipeline_stage_runs s
    join selected_run r on s.run_id = r.run_id
  ), '[]'::jsonb),
  'quarantined', (select count(*)::integer from ops.quarantine_records q join selected_run r on q.run_id = r.run_id),
  'qualityPassed', coalesce((select passed from quality), 0),
  'qualityTotal', coalesce((select total from quality), 0),
  'qualityFailed', coalesce((select failed from quality), 0)
)::text;`;
const summary = parseJson(psql(databaseUrl, ['--command', summarySql]), 'benchmark summary');
const watermarksAfter = parseJson(psql(databaseUrl, [
  '--command', `select coalesce(jsonb_agg(jsonb_build_object(
    'sourceName', source_name,
    'watermarkTs', watermark_ts,
    'watermarkSourceId', watermark_source_id,
    'lastSuccessfulRunId', last_successful_run_id
  ) order by source_name), '[]'::jsonb)::text from ops.etl_watermarks;`,
]), 'post-backfill watermarks');

const queryLatency = parseJson(psql(databaseUrl, [
  '--set', `query_samples=${modeConfig.querySamples}`,
  '--file', resolve(root, 'benchmarks/sql/profile-queries.sql'),
]), 'query latency profile');

const explainQueries = {
  portfolioKpis: `select
    (select sum(written_premium) from public.fact_premium) as written_premium,
    (select sum(earned_premium) from public.fact_premium) as earned_premium,
    (select sum(incurred_loss) from public.fact_loss) as incurred_loss`,
  lobPerformance: `with premium as (
    select lob_key, sum(earned_premium) as earned_premium
    from public.fact_premium group by lob_key
  ), losses as (
    select lob_key, sum(incurred_loss) as incurred_loss
    from public.fact_loss group by lob_key
  )
  select l.lob_code, p.earned_premium, x.incurred_loss,
    x.incurred_loss / nullif(p.earned_premium, 0) as loss_ratio
  from public.dim_lob l
  left join premium p using (lob_key)
  left join losses x using (lob_key)
  order by l.lob_code`,
  pipelineEvidence: `select * from public.vw_pipeline_runs
    order by started_at desc limit 20`,
};
const explainAnalyze = Object.fromEntries(Object.entries(explainQueries).map(([name, sql]) => [
  name,
  parseJson(psql(databaseUrl, [
    '--command', `explain (analyze, buffers, wal, settings, format json) ${sql};`,
  ]), `${name} EXPLAIN ANALYZE`),
]));
const totalMs = elapsedMs(totalStart);

const failures = [];
if (summary.stagedPremium !== modeConfig.premiumRows) failures.push(`expected ${modeConfig.premiumRows} staged premium rows; found ${summary.stagedPremium}`);
if (summary.stagedClaims !== modeConfig.claimRows) failures.push(`expected ${modeConfig.claimRows} staged claim rows; found ${summary.stagedClaims}`);
if (summary.premiumFacts !== modeConfig.premiumRows) failures.push(`expected ${modeConfig.premiumRows} premium facts; found ${summary.premiumFacts}`);
if (summary.lossFacts !== modeConfig.claimRows) failures.push(`expected ${modeConfig.claimRows} loss facts; found ${summary.lossFacts}`);
if (summary.stageRuns === 0) failures.push('no stage-level observability records were recorded for the benchmark run');
if (summary.qualityTotal < 6) failures.push(`expected at least 6 data-quality checks; found ${summary.qualityTotal}`);
if (summary.qualityFailed > 0) failures.push(`${summary.qualityFailed} data-quality checks failed`);
if (summary.status !== 'success') failures.push(`pipeline status was ${summary.status ?? 'missing'}, not success`);
if (JSON.stringify(watermarksBefore) !== JSON.stringify(watermarksAfter)) failures.push('backfill changed incremental ETL watermarks');
if (totalMs > modeConfig.maxTotalMs) failures.push(`total runtime ${totalMs}ms exceeded ${modeConfig.maxTotalMs}ms`);

const result = {
  schemaVersion: config.schemaVersion,
  createdAt: new Date().toISOString(),
  benchmark: {
    mode: args.mode,
    seed: config.seed,
    premiumRows: modeConfig.premiumRows,
    claimRows: modeConfig.claimRows,
    totalRows: modeConfig.totalRows,
    from: config.window.from,
    to: config.window.to,
    calculationAsOf: config.window.calculationAsOf,
  },
  environment: {
    gitSha: process.env.GITHUB_SHA ?? gitSha(),
    nodeVersion: process.version,
    ci: process.env.CI === 'true',
  },
  database: {
    postgresVersion: summary.postgresVersion,
  },
  timing: {
    seedMs,
    pipelineMs,
    totalMs,
    rowsPerSecond: Number((modeConfig.totalRows / Math.max(pipelineMs / 1000, 0.001)).toFixed(2)),
  },
  pipeline: {
    response: pipelineResponse,
    runId: summary.runId ?? safeRunId,
    status: summary.status ?? null,
    watermarksBefore,
    watermarksAfter,
  },
  loadMetrics: {
    sourceRows: summary.sourceRows,
    insertedRows: summary.insertedRows,
    updatedRows: summary.updatedRows,
    unchangedRows: summary.unchangedRows,
    deduplicatedRows: summary.unchangedRows,
    recalculatedRows: summary.recalculatedRows,
    rejectedRows: summary.rejectedRows,
  },
  stageDurations: summary.stageDurations,
  queryLatency,
  explainAnalyze,
  counts: {
    stagedPremium: summary.stagedPremium,
    stagedClaims: summary.stagedClaims,
    premiumFacts: summary.premiumFacts,
    lossFacts: summary.lossFacts,
    stageRuns: summary.stageRuns,
    quarantined: summary.quarantined,
  },
  quality: {
    passed: summary.qualityPassed,
    total: summary.qualityTotal,
    failed: summary.qualityFailed,
  },
  thresholds: {
    maxTotalMs: modeConfig.maxTotalMs,
    expectedTotalRows: modeConfig.totalRows,
  },
  passed: failures.length === 0,
  failures,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Benchmark ${args.mode}: ${result.passed ? 'PASS' : 'FAIL'} (${totalMs}ms, ${result.timing.rowsPerSecond} rows/s)`);
console.log(`Result: ${output}`);
if (!result.passed) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
