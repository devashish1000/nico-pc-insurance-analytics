-- Remove every direct browser capability from base tables and sequences. RLS
-- does not govern TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, so SELECT-only revokes
-- are insufficient on projects whose platform defaults granted those rights.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;

-- Re-publish only the bounded presentation surfaces. Their private inner views
-- remain read-only and their public wrappers run with security_invoker enabled.
grant select on
  public.vw_kpi_summary,
  public.vw_loss_ratio_by_lob,
  public.vw_premium_trend_monthly,
  public.vw_loss_trend_monthly,
  public.vw_top_agents,
  public.vw_state_premium,
  public.vw_data_quality_latest,
  public.vw_warehouse_objects,
  public.vw_pipeline_runs
to anon, authenticated, service_role;

-- Cover every warehouse foreign key used by refreshes, joins, and referential
-- actions. Existing LOB/date indexes are retained and not duplicated here.
create index if not exists dim_policy_lob_key_idx
  on public.dim_policy (lob_key);
create index if not exists dim_policy_insured_key_idx
  on public.dim_policy (insured_key);
create index if not exists dim_policy_agent_key_idx
  on public.dim_policy (agent_key);

create index if not exists fact_loss_effective_date_key_idx
  on public.fact_loss (effective_date_key);
create index if not exists fact_loss_policy_key_idx
  on public.fact_loss (policy_key);
create index if not exists fact_loss_txn_type_key_idx
  on public.fact_loss (txn_type_key);

create index if not exists fact_premium_effective_date_key_idx
  on public.fact_premium (effective_date_key);
create index if not exists fact_premium_policy_key_idx
  on public.fact_premium (policy_key);
create index if not exists fact_premium_insured_key_idx
  on public.fact_premium (insured_key);
create index if not exists fact_premium_agent_key_idx
  on public.fact_premium (agent_key);
create index if not exists fact_premium_txn_type_key_idx
  on public.fact_premium (txn_type_key);
