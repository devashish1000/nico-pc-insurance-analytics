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
};
