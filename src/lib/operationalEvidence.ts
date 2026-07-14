import type {
  BenchmarkArtifact,
  PipelineAction,
  PipelineRun,
  QuarantineEvidence,
} from './supabase';

export const primaryBenchmarkArtifact: BenchmarkArtifact = {
  schemaVersion: '1.0.0',
  status: 'configured',
  label: 'Disposable CI benchmark contract',
  provenance: 'GitHub Actions artifact generated from a fresh local Supabase database',
  mode: 'primary',
  premiumRows: 100_000,
  claimRows: 50_000,
  totalRows: 150_000,
  postgresVersion: null,
  p50Ms: null,
  p95Ms: null,
  disclaimer: 'Synthetic portfolio data in an isolated CI database. This is not live NICO data, a production workload, or a production-scale claim.',
};

export function formatDuration(duration: number | null) {
  if (duration == null) return 'Not recorded';
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} sec`;
}

export function formatFreshness(seconds: number | null) {
  if (seconds == null) return 'Not recorded';
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

export function getRecoveryTarget(rows: QuarantineEvidence[]) {
  return rows.find((row) => row.disposition === 'pending' && row.recoverable === true)?.run_id ?? null;
}

export function getRunFailureReason(run: PipelineRun | undefined) {
  if (!run || run.status !== 'failed') return null;
  return run.error_message || 'The run failed with a sanitized reason unavailable in the public evidence view.';
}

export function actionCopy(action: PipelineAction) {
  if (action === 'simulate-failure') return 'Controlled failure';
  if (action === 'recover') return 'Recovery';
  return 'Normal run';
}

export function qualityOutcome(passed: number | null, total: number | null) {
  if (passed == null || total == null || total === 0) return 'NOT RECORDED';
  return passed === total ? `PASS · ${passed} of ${total}` : `FAIL · ${passed} of ${total}`;
}
