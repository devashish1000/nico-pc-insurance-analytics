import { createClient } from '@supabase/supabase-js';

// Publishable/anon key — safe to expose in client bundles (read-only, RLS-guarded synthetic data).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://azmcrbiakbsauclgpzeh.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_SctEmhdRKZ43fYP8MBej5A_0Oyf5u5b';

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
