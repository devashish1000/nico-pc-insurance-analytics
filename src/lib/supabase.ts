import { createClient } from '@supabase/supabase-js';

// Publishable key: browser-safe and RLS-guarded. Privileged keys are server-only.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing public Supabase configuration.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

export type KpiSummary = {
  written_premium: number;
  earned_premium: number;
  unearned_premium: number;
  incurred_loss: number;
  paid_loss: number;
  open_reserves: number;
  policy_count: number;
  claim_count: number;
  loss_ratio_pct: number;
};

export type LobRow = {
  lob_code: string;
  lob_name: string;
  policy_count: number;
  written_premium: number;
  incurred_loss: number;
  loss_ratio_pct: number;
};

export type TrendRow = { ym: string; written_premium?: number; earned_premium?: number; incurred_loss?: number };
export type AgentRow = { agent_name: string; agency: string; region: string; written_premium: number; policy_count: number };
export type StateRow = { state: string; written_premium: number; policy_count: number };
export type DqRow = {
  check_name: string; category: string; severity: string; status: string;
  expected_value: string; actual_value: string; checked_at: string;
};
export type WhObject = { layer: string; object_name: string; row_count: number };
export type PipelineRun = {
  run_id: string;
  trigger_type: 'manual' | 'scheduled';
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'failed' | 'cooldown';
  duration_ms: number | null;
  premium_rows: number | null;
  loss_rows: number | null;
  dq_run_id: string | null;
  checks_passed: number | null;
  checks_total: number | null;
  error_message: string | null;
  mode: 'full' | 'incremental' | 'backfill' | null;
  scenario: 'controlled-failure' | 'recovery' | null;
  watermark_start: Record<string, unknown> | null;
  watermark_end: Record<string, unknown> | null;
  source_rows: number | null;
  inserted_rows: number | null;
  updated_rows: number | null;
  unchanged_rows: number | null;
  recalculated_rows: number | null;
  rejected_rows: number | null;
  freshness_lag_seconds: number | null;
  recovered_from_run_id: string | null;
};

export type PipelineStageRun = {
  run_id: string;
  stage_order: number;
  stage_name: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  input_rows: number;
  inserted_rows: number;
  updated_rows: number;
  unchanged_rows: number;
  recalculated_rows: number;
  rejected_rows: number;
  error_code: string | null;
  sanitized_error: string | null;
};

export type QuarantineEvidence = {
  quarantine_id: string;
  run_id: string;
  source_name: 'premium' | 'claim';
  reason_code: string;
  severity: 'warning' | 'critical';
  disposition: 'pending' | 'replayed' | 'discarded';
  quarantined_at: string;
  resolved_at: string | null;
  recovered_by_run_id: string | null;
  recoverable: boolean;
};

export type PipelineAction = 'run' | 'simulate-failure' | 'recover';

export type PipelineActionResponse = {
  runId?: string;
  status?: PipelineRun['status'];
  trigger?: PipelineRun['trigger_type'];
  mode?: PipelineRun['mode'];
  scenario?: PipelineRun['scenario'];
  startedAt?: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  rowCounts?: { factPremium: number | null; factLoss: number | null };
  dq?: { runId: string | null; passed: number | null; total: number | null };
  watermarks?: { start: Record<string, unknown> | null; end: Record<string, unknown> | null };
  counts?: {
    source: number;
    inserted: number;
    updated: number;
    unchanged: number;
    recalculated: number;
    rejected: number;
  };
  freshnessLagSeconds?: number | null;
  recoveredFromRunId?: string | null;
  stages?: Array<{
    order: number;
    name: string;
    status: PipelineStageRun['status'];
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    inputRows: number;
    insertedRows: number;
    updatedRows: number;
    unchangedRows: number;
    recalculatedRows: number;
    rejectedRows: number;
    error: string | null;
  }>;
  quarantine?: Array<{
    id: string;
    runId: string;
    source: QuarantineEvidence['source_name'];
    reason: string;
    severity: QuarantineEvidence['severity'];
    disposition: QuarantineEvidence['disposition'];
    quarantinedAt: string;
    resolvedAt: string | null;
    recoveredByRunId: string | null;
  }>;
  message?: string;
};

export type BenchmarkArtifact = {
  schemaVersion: '1.0.0';
  status: 'configured' | 'recorded';
  label: string;
  provenance: string;
  mode: 'smoke' | 'primary' | 'extended';
  premiumRows: number;
  claimRows: number;
  totalRows: number;
  postgresVersion: string | null;
  p50Ms: number | null;
  p95Ms: number | null;
  disclaimer: string;
};
