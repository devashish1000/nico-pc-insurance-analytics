begin;

set local search_path = extensions, public, pg_catalog;

select plan(5);

insert into public.pipeline_runs (
  run_id, trigger_type, started_at, finished_at, status, mode, scenario
) values
  (
    '70000000-0000-0000-0000-000000000001', 'scheduled',
    timestamptz '2026-07-14 00:30:00+00', timestamptz '2026-07-14 00:30:01+00',
    'failed', 'incremental', null
  ),
  (
    '70000000-0000-0000-0000-000000000002', 'manual',
    timestamptz '2026-07-14 00:31:00+00', timestamptz '2026-07-14 00:31:01+00',
    'failed', 'incremental', 'controlled-failure'
  );

insert into ops.pipeline_batches (
  batch_id, run_id, source_name, mode, status, source_rows,
  created_at, finished_at
) values
  (
    '70000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'all', 'incremental', 'failed', 1,
    timestamptz '2026-07-14 00:30:00+00', timestamptz '2026-07-14 00:30:01+00'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000002',
    'all', 'demo', 'failed', 1,
    timestamptz '2026-07-14 00:31:00+00', timestamptz '2026-07-14 00:31:01+00'
  );

insert into ops.quarantine_records (
  quarantine_id, run_id, batch_id, source_name, source_txn_id,
  reason_code, severity, payload, disposition, quarantined_at
) values
  (
    '70000000-0000-0000-0000-000000000011',
    '70000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'premium', 'tap-non-demo-pending', 'MISSING_POLICY_NUMBER',
    'critical', '{"fixture":"non-demo"}'::jsonb, 'pending',
    timestamptz '2026-07-14 00:30:00.500+00'
  ),
  (
    '70000000-0000-0000-0000-000000000012',
    '70000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000002',
    'premium', 'tap-controlled-demo-pending', 'MISSING_POLICY_NUMBER',
    'critical', '{"fixture":"controlled-demo"}'::jsonb, 'pending',
    timestamptz '2026-07-14 00:31:00.500+00'
  );

create temporary table tap_invalid_recovery as
select public.run_demo_pipeline_action(
  'recover', '70000000-0000-0000-0000-000000000001'::uuid
) as result;

select is(
  (select result->>'accepted' from tap_invalid_recovery),
  'false',
  'a pending quarantine outside the controlled-failure contract is rejected'
);

select is((
  select count(*)::integer
  from public.pipeline_runs
  where scenario = 'recovery'
    and recovered_from_run_id = '70000000-0000-0000-0000-000000000001'
), 0, 'an invalid target never reaches the private recovery runner');

select ok(exists (
  select 1
  from ops.quarantine_records
  where run_id = '70000000-0000-0000-0000-000000000001'
    and disposition = 'pending'
    and recovered_by_run_id is null
), 'the rejected quarantine remains unchanged');

select is((
  select recoverable
  from public.vw_quarantine_evidence
  where run_id = '70000000-0000-0000-0000-000000000001'
), false, 'public evidence does not offer recovery for a non-demo pending row');

select is((
  select recoverable
  from public.vw_quarantine_evidence
  where run_id = '70000000-0000-0000-0000-000000000002'
), true, 'public evidence marks only the failed controlled demo as recoverable');

select * from finish();
rollback;
