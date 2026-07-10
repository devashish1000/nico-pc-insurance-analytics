import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../supabase/migrations/20260710214842_harden_analytics_view_boundary.sql', import.meta.url),
  'utf8',
).toLowerCase();

const publicViews = [
  'vw_kpi_summary',
  'vw_loss_ratio_by_lob',
  'vw_premium_trend_monthly',
  'vw_loss_trend_monthly',
  'vw_top_agents',
  'vw_state_premium',
  'vw_data_quality_latest',
  'vw_warehouse_objects',
  'vw_pipeline_runs',
];

describe('analytics view security boundary', () => {
  it('makes every exposed analytics view security-invoker', () => {
    for (const view of publicViews) {
      expect(migration).toContain(`create or replace view public.${view}\nwith (security_invoker = true, security_barrier = true)`);
    }
  });

  it('removes browser access to base tables and the legacy history RPC', () => {
    expect(migration).toContain('revoke select on all tables in schema public from public, anon, authenticated');
    expect(migration).toContain('drop policy if exists anon_read on public.%i');
    expect(migration).toContain('revoke execute on function public.get_pipeline_runs() from anon, authenticated');
  });

  it('grants browser roles only bounded private and public data surfaces', () => {
    expect(migration).toContain('revoke all privileges on all tables in schema private from public, anon, authenticated');
    expect(migration).toContain('grant usage on schema private to anon, authenticated, service_role');
    for (const view of publicViews) {
      expect(migration).toContain(`public.${view}`);
    }
  });
});
