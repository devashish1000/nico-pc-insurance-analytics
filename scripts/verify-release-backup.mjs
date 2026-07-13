import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const stamp = process.env.BACKUP_STAMP ?? '20260713T231304Z';
const releaseDirectory = resolve('artifacts/release');
const prefix = `backup-${stamp}-`;

const expectedCounts = {
  'public.dim_date': 1065,
  'public.dim_lob': 5,
  'public.dim_insured': 600,
  'public.dim_agent': 12,
  'public.dim_transaction_type': 7,
  'public.dim_policy': 600,
  'public.fact_premium': 600,
  'public.fact_loss': 320,
  'public.dq_results': 48,
  'public.pipeline_runs': 7,
  'staging.raw_premium_txn': 600,
  'staging.raw_claim_txn': 320,
};

const files = (await readdir(releaseDirectory))
  .filter((file) => file.startsWith(prefix) && file.endsWith('.json'))
  .sort();

if (!files.length) throw new Error(`No logical backup files found for ${stamp}.`);

const counts = {};
const parts = [];

for (const file of files) {
  const bytes = await readFile(resolve(releaseDirectory, file));
  const document = JSON.parse(bytes.toString('utf8'));
  if (document.format !== 'nico-logical-table-part-v1') throw new Error(`${file} has an unexpected format.`);
  if (document.projectRef !== 'uketehwjsvpnohxhdvxa') throw new Error(`${file} targets an unexpected project.`);
  if (!Array.isArray(document.rows) || document.rows.length !== document.rowCount) {
    throw new Error(`${file} has an invalid row-count contract.`);
  }
  const key = `${document.schema}.${document.table}`;
  counts[key] = (counts[key] ?? 0) + document.rowCount;
  parts.push({
    file: `artifacts/release/${file}`,
    table: key,
    part: document.part,
    rows: document.rowCount,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const stableEntries = (record) => Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
if (JSON.stringify(stableEntries(counts)) !== JSON.stringify(stableEntries(expectedCounts))) {
  throw new Error(`Backup counts do not match the captured baseline: ${JSON.stringify(counts)}`);
}

const manifest = {
  format: 'nico-hosted-logical-backup-manifest-v1',
  capturedAtUtc: '2026-07-13T23:13:04.347568Z',
  projectRef: 'uketehwjsvpnohxhdvxa',
  projectName: 'NICO P&C Insurance Analytics',
  postgresVersion: '17.6',
  schemaFingerprint: '982e92211df5a0a6588ad767f44d442e',
  sourceChecksums: {
    'public.dim_policy': '96e6c284d123feb1f1758229b160ce50',
    'public.fact_premium': 'a0e488f325b68b41f28fe91830fb4a96',
    'public.fact_loss': '67b0f090df306b4b16ff434cc0f9658a',
    'public.pipeline_runs': 'c939c727d62d54f373141be4f60a064a',
    'staging.raw_premium_txn': '8d4c86c8e99176797efafe7616ec015a',
    'staging.raw_claim_txn': 'c0e54dbfed2dc27d7740ad240453f292',
  },
  counts,
  totalRows: Object.values(counts).reduce((sum, count) => sum + count, 0),
  parts,
  aggregateSha256: createHash('sha256')
    .update(parts.map((part) => `${part.file}:${part.sha256}`).join('\n'))
    .digest('hex'),
  boundaries: [
    'All exported rows are synthetic portfolio data.',
    'The migration files in supabase/migrations remain the schema source of truth.',
    'This snapshot was captured before the additive warehouse-v2 release migration sequence.',
  ],
};

const output = resolve(releaseDirectory, `hosted-logical-backup-${stamp}-manifest.json`);
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, partCount: parts.length, totalRows: manifest.totalRows, aggregateSha256: manifest.aggregateSha256 }));
