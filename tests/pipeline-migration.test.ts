import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../supabase/migrations/20260710204410_secure_pipeline_runs.sql', import.meta.url), 'utf8');

describe('pipeline migration privilege contract', () => {
  it('revokes browser access to raw ETL and the run-history base table', () => {
    expect(sql).toContain('revoke all on public.pipeline_runs from public, anon, authenticated');
    expect(sql).toContain('grant select on public.pipeline_runs to service_role');
    expect(sql).toContain('revoke execute on function public.sp_load_facts() from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.run_demo_pipeline() to service_role');
  });

  it('publishes bounded history through a read-only function', () => {
    expect(sql).toContain('create or replace function public.get_pipeline_runs()');
    expect(sql).toContain('limit 14');
    expect(sql).toContain('grant execute on function public.get_pipeline_runs() to anon, authenticated, service_role');
  });

  it('requires six passing controls before success and schedules the nightly job', () => {
    expect(sql).toContain('v_checks_total = 6 and v_checks_passed = v_checks_total');
    expect(sql).toContain("'nico-nightly-warehouse-refresh'");
    expect(sql).toContain("'15 6 * * *'");
  });
});
