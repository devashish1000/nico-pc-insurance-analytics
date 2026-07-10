-- Resolve hosted Security Advisor warnings without widening the public API.
-- These ETL routines are invoked only by the fixed-search-path orchestrator,
-- but their own resolution must also remain deterministic.
alter function public.sp_populate_dim_date(date, date) set search_path = '';
alter function public.sp_load_facts() set search_path = '';
alter function public.sp_run_data_quality() set search_path = '';

-- Supabase's optional automatic-RLS feature installs this trigger function.
-- A trigger does not require browser roles to retain direct EXECUTE permission.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
