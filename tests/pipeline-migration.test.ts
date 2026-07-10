import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../supabase/migrations/20260710204410_secure_pipeline_runs.sql', import.meta.url), 'utf8');
const advisorSql = readFileSync(
  new URL('../supabase/migrations/20260710222126_harden_advisor_findings.sql', import.meta.url),
  'utf8',
);
const privilegesSql = readFileSync(
  new URL('../supabase/migrations/20260710222439_lock_down_base_tables_and_fk_indexes.sql', import.meta.url),
  'utf8',
);

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

  it('fixes mutable ETL search paths and revokes automatic-RLS trigger access', () => {
    expect(advisorSql).toContain("alter function public.sp_populate_dim_date(date, date) set search_path = ''");
    expect(advisorSql).toContain("alter function public.sp_load_facts() set search_path = ''");
    expect(advisorSql).toContain("alter function public.sp_run_data_quality() set search_path = ''");
    expect(advisorSql).toContain(
      "revoke all on function public.rls_auto_enable() from public, anon, authenticated",
    );
  });

  it('denies every base-table capability and covers warehouse foreign keys', () => {
    expect(privilegesSql).toContain(
      'revoke all on all tables in schema public from public, anon, authenticated',
    );
    expect(privilegesSql).toContain(
      'alter default privileges in schema public revoke all on tables from public, anon, authenticated',
    );
    expect(privilegesSql).toContain('grant select on\n  public.vw_kpi_summary');

    for (const index of [
      'dim_policy_lob_key_idx',
      'dim_policy_insured_key_idx',
      'dim_policy_agent_key_idx',
      'fact_loss_effective_date_key_idx',
      'fact_loss_policy_key_idx',
      'fact_loss_txn_type_key_idx',
      'fact_premium_effective_date_key_idx',
      'fact_premium_policy_key_idx',
      'fact_premium_insured_key_idx',
      'fact_premium_agent_key_idx',
      'fact_premium_txn_type_key_idx',
    ]) {
      expect(privilegesSql).toContain(index);
    }
  });
});
