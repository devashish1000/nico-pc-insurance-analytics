import { ACCEPTANCE_CASES, executeAcceptance } from './acceptance';
import { supabase } from './supabase';

export type ProofState = 'success' | 'attention' | 'error';

export type ProofMetric = {
  label: string;
  value: string;
  detail: string;
  state: ProofState;
  observedAt?: string;
};

export type ProofSnapshot = {
  dataQuality: ProofMetric;
  acceptance: ProofMetric;
  pipelineRuns: ProofMetric;
  verifiedAt: string;
  degraded: boolean;
};

const CACHE_WINDOW_MS = 60_000;

let cache: { expiresAt: number; promise: Promise<ProofSnapshot> } | undefined;

function unavailable(label: string, detail: string): ProofMetric {
  return { label, value: 'Unavailable', detail, state: 'error' };
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : undefined;
}

async function verifyAcceptance(): Promise<ProofMetric> {
  const results = await Promise.all(ACCEPTANCE_CASES.map(executeAcceptance));
  const passed = results.filter((result) => result.status === 'pass').length;
  const total = results.length;
  return {
    label: 'Acceptance verification',
    value: `${passed}/${total}`,
    detail: passed === total ? 'Executable cases passing' : `${total - passed} case${total - passed === 1 ? '' : 's'} need attention`,
    state: passed === total && total === 10 ? 'success' : 'attention',
    observedAt: new Date().toISOString(),
  };
}

async function verifyDataQuality(): Promise<ProofMetric> {
  const { data, error } = await supabase
    .from('vw_data_quality_latest')
    .select('status,checked_at');

  if (error) throw new Error('Data-quality evidence could not be verified.');
  const rows = data ?? [];
  if (!rows.length) return unavailable('Latest data quality', 'No published quality evidence');

  const passed = rows.filter((row) => row.status === 'pass').length;
  return {
    label: 'Latest data quality',
    value: `${passed}/${rows.length}`,
    detail: passed === rows.length ? 'Public controls passing' : `${rows.length - passed} control${rows.length - passed === 1 ? '' : 's'} need attention`,
    state: passed === rows.length && rows.length === 6 ? 'success' : 'attention',
    observedAt: latestTimestamp(rows.map((row) => row.checked_at)),
  };
}

async function verifyPipelineRuns(): Promise<ProofMetric> {
  const { data, error } = await supabase
    .from('vw_pipeline_runs')
    .select('status,started_at,finished_at')
    .order('started_at', { ascending: false })
    .limit(14);

  if (error) throw new Error('Pipeline history could not be verified.');
  const rows = data ?? [];
  if (!rows.length) return unavailable('Successful recorded runs', 'No bounded run history');

  const successful = rows.filter((row) => row.status === 'success').length;
  return {
    label: 'Successful recorded runs',
    value: `${successful} of ${rows.length}`,
    detail: 'Latest bounded public history',
    state: successful === rows.length ? 'success' : 'attention',
    observedAt: latestTimestamp(rows.flatMap((row) => [row.finished_at, row.started_at])),
  };
}

function metricFromResult(
  result: PromiseSettledResult<ProofMetric>,
  label: string,
  detail: string,
): ProofMetric {
  return result.status === 'fulfilled' ? result.value : unavailable(label, detail);
}

async function createProofSnapshot(): Promise<ProofSnapshot> {
  const [acceptanceResult, dataQualityResult, pipelineResult] = await Promise.allSettled([
    verifyAcceptance(),
    verifyDataQuality(),
    verifyPipelineRuns(),
  ]);

  const acceptance = metricFromResult(
    acceptanceResult,
    'Acceptance verification',
    'Executable evidence could not be verified',
  );
  const dataQuality = metricFromResult(
    dataQualityResult,
    'Latest data quality',
    'Published quality evidence could not be verified',
  );
  const pipelineRuns = metricFromResult(
    pipelineResult,
    'Successful recorded runs',
    'Run history could not be verified',
  );

  return {
    dataQuality,
    acceptance,
    pipelineRuns,
    verifiedAt: new Date().toISOString(),
    degraded: [dataQuality, acceptance, pipelineRuns].some((metric) => metric.state !== 'success'),
  };
}

export function loadProofSnapshot(options: { force?: boolean } = {}) {
  const now = Date.now();
  if (!options.force && cache && cache.expiresAt > now) return cache.promise;

  const promise = createProofSnapshot();
  cache = { expiresAt: now + CACHE_WINDOW_MS, promise };
  return promise;
}

export function invalidateProofSnapshot() {
  cache = undefined;
}
