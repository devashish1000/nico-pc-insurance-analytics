begin;

set local search_path = extensions, public, pg_catalog;

select plan(27);

select ok(not has_table_privilege('anon', 'ops.pipeline_batches', 'select'),
  'anonymous clients cannot read pipeline batches');
select ok(not has_table_privilege('authenticated', 'ops.pipeline_batches', 'select'),
  'authenticated clients cannot read pipeline batches');
select ok(not has_table_privilege('anon', 'ops.etl_watermarks', 'select'),
  'anonymous clients cannot read watermarks');
select ok(not has_table_privilege('authenticated', 'ops.etl_watermarks', 'select'),
  'authenticated clients cannot read watermarks');
select ok(not has_table_privilege('anon', 'ops.pipeline_stage_runs', 'select'),
  'anonymous clients cannot read raw stage evidence');
select ok(not has_table_privilege('authenticated', 'ops.pipeline_stage_runs', 'select'),
  'authenticated clients cannot read raw stage evidence');
select ok(not has_table_privilege('anon', 'ops.quarantine_records', 'select'),
  'anonymous clients cannot read quarantined payloads');
select ok(not has_table_privilege('authenticated', 'ops.quarantine_records', 'select'),
  'authenticated clients cannot read quarantined payloads');

select ok(not has_function_privilege('anon', 'public.run_demo_pipeline_action(text,uuid)', 'execute'),
  'anonymous clients cannot execute pipeline actions');
select ok(not has_function_privilege('authenticated', 'public.run_demo_pipeline_action(text,uuid)', 'execute'),
  'authenticated clients cannot execute pipeline actions');
select ok(has_function_privilege('service_role', 'public.run_demo_pipeline_action(text,uuid)', 'execute'),
  'service role can execute pipeline actions');
select ok(not has_function_privilege('anon', 'public.run_demo_backfill(date,date)', 'execute'),
  'anonymous clients cannot execute backfills');
select ok(not has_function_privilege('authenticated', 'public.run_demo_backfill(date,date)', 'execute'),
  'authenticated clients cannot execute backfills');
select ok(has_function_privilege('service_role', 'public.run_demo_backfill(date,date)', 'execute'),
  'service role can execute bounded backfills');
select ok(not has_function_privilege('anon', 'public.run_demo_pipeline()', 'execute'),
  'anonymous clients cannot execute the legacy pipeline entrypoint');
select ok(not has_function_privilege('authenticated', 'public.run_demo_pipeline()', 'execute'),
  'authenticated clients cannot execute the legacy pipeline entrypoint');
select ok(has_function_privilege('service_role', 'public.run_demo_pipeline()', 'execute'),
  'service role retains the legacy pipeline entrypoint');

select ok(has_table_privilege('anon', 'public.vw_pipeline_stage_runs', 'select'),
  'anonymous clients can read bounded stage evidence');
select ok(has_table_privilege('authenticated', 'public.vw_pipeline_stage_runs', 'select'),
  'authenticated clients can read bounded stage evidence');
select ok(has_table_privilege('anon', 'public.vw_quarantine_evidence', 'select'),
  'anonymous clients can read sanitized quarantine evidence');
select ok(has_table_privilege('authenticated', 'public.vw_quarantine_evidence', 'select'),
  'authenticated clients can read sanitized quarantine evidence');
select ok(has_table_privilege('anon', 'public.vw_policy_scd2_evidence', 'select'),
  'anonymous clients can read bounded SCD2 evidence');
select ok(has_table_privilege('authenticated', 'public.vw_policy_scd2_evidence', 'select'),
  'authenticated clients can read bounded SCD2 evidence');

select ok(coalesce((
  select c.reloptions @> array['security_invoker=true']
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'vw_pipeline_stage_runs'
), false), 'stage evidence view uses invoker security');
select ok(coalesce((
  select c.reloptions @> array['security_invoker=true']
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'vw_quarantine_evidence'
), false), 'quarantine evidence view uses invoker security');
select ok(coalesce((
  select c.reloptions @> array['security_invoker=true']
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'vw_policy_scd2_evidence'
), false), 'SCD2 evidence view uses invoker security');

select ok(not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'vw_quarantine_evidence'
    and column_name in ('payload', 'raw_payload', 'record_payload', 'stack_trace', 'sqlstate')
), 'public quarantine evidence excludes raw payload and internal diagnostics');

select * from finish();
rollback;
