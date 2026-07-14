import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../benchmarks/config.json', import.meta.url), 'utf8')) as {
  schemaVersion: string;
  seed: number;
  modes: Record<string, { premiumRows: number; claimRows: number; totalRows: number; ci: string }>;
};
const runner = readFileSync(new URL('../scripts/run-benchmark.mjs', import.meta.url), 'utf8');
const seedSql = readFileSync(new URL('../benchmarks/sql/prepare-source.sql', import.meta.url), 'utf8');
const resultSchema = JSON.parse(readFileSync(new URL('../benchmarks/results/benchmark-result.schema.json', import.meta.url), 'utf8')) as {
  properties: { schemaVersion: { const: string } };
};

describe('deterministic benchmark contract', () => {
  it('defines the agreed 10K, 150K, and 1M modes', () => {
    expect(config.modes.smoke.totalRows).toBe(10_000);
    expect(config.modes.primary.totalRows).toBe(150_000);
    expect(config.modes.extended.totalRows).toBe(1_000_000);
    for (const mode of Object.values(config.modes)) {
      expect(mode.premiumRows + mode.claimRows).toBe(mode.totalRows);
    }
  });

  it('keeps the million-row run manual-only', () => {
    expect(config.modes.extended.ci).toBe('manual-only');
    expect(config.modes.smoke.ci).toBe('pull-request');
    expect(config.modes.primary.ci).toBe('main-and-scheduled');
  });

  it('uses deterministic set generation and a fixed seed', () => {
    expect(Number.isInteger(config.seed)).toBe(true);
    expect(seedSql).toContain('generate_series');
    expect(seedSql).not.toMatch(/\brandom\s*\(/i);
    expect(seedSql).toContain("md5('nico-benchmark:'");
  });

  it('guards destructive execution and emits the versioned result contract', () => {
    expect(runner).toContain('ALLOW_REMOTE_BENCHMARK');
    expect(runner).toContain('run_demo_backfill');
    expect(runner).toContain('queryLatency');
    expect(runner).toContain('explainAnalyze');
    expect(runner).toContain('stageDurations');
    expect(runner).toContain('deduplicatedRows');
    expect(config.schemaVersion).toBe('1.0.0');
    expect(resultSchema.properties.schemaVersion.const).toBe(config.schemaVersion);
  });

  it('validates a conforming benchmark artifact without third-party runtime packages', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nico-benchmark-contract-'));
    const artifact = join(directory, 'result.json');
    writeFileSync(artifact, JSON.stringify({
      schemaVersion: '1.0.0',
      createdAt: '2026-07-13T12:00:00.000Z',
      benchmark: { mode: 'smoke', seed: config.seed, premiumRows: 6_500, claimRows: 3_500, totalRows: 10_000 },
      environment: {},
      database: { postgresVersion: '17.4' },
      timing: { seedMs: 1, pipelineMs: 1, totalMs: 2, rowsPerSecond: 10_000 },
      pipeline: {},
      loadMetrics: { sourceRows: 10_000, insertedRows: 10_000, updatedRows: 0, unchangedRows: 0, deduplicatedRows: 0, recalculatedRows: 0, rejectedRows: 0 },
      stageDurations: [],
      queryLatency: { samples: 21, p50Ms: 1, p95Ms: 2, queries: [{ name: 'test', samples: 7, p50Ms: 1, p95Ms: 2 }] },
      explainAnalyze: { portfolioKpis: [{}], lobPerformance: [{}], pipelineEvidence: [{}] },
      counts: { stagedPremium: 6_500, stagedClaims: 3_500, premiumFacts: 6_500, lossFacts: 3_500, stageRuns: 6, quarantined: 0 },
      quality: { passed: 6, total: 6, failed: 0 },
      thresholds: {},
      passed: true,
      failures: [],
    }));

    const validation = spawnSync(process.execPath, [new URL('../scripts/validate-benchmark-result.mjs', import.meta.url).pathname, artifact], {
      encoding: 'utf8',
    });
    rmSync(directory, { recursive: true, force: true });

    expect(validation.status).toBe(0);
    expect(validation.stdout).toContain('Valid benchmark result');
  });
});
