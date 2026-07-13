begin;

set local search_path = extensions, public, pg_catalog;

select plan(6);

insert into public.pipeline_runs (
  run_id, trigger_type, started_at, finished_at, status, mode, scenario
) values
  ('40000000-0000-0000-0000-00000000000a', 'manual',
   timestamptz '2026-07-13 12:00:00+00', timestamptz '2026-07-13 12:01:00+00',
   'failed', 'incremental', 'controlled-failure'),
  ('40000000-0000-0000-0000-00000000000b', 'manual',
   timestamptz '2026-07-13 12:02:00+00', null,
   'running', 'backfill', null);

insert into ops.pipeline_batches (
  batch_id, run_id, source_name, mode, requested_from, requested_to,
  cutoff_at, status, source_rows, created_at, finished_at
) values
  ('40000000-0000-0000-0000-00000000000a',
   '40000000-0000-0000-0000-00000000000a', 'all', 'demo',
   date '2025-01-01', date '2025-12-31', timestamptz '2026-01-01 00:00:00+00',
   'failed', 1, timestamptz '2026-07-13 12:00:00+00', timestamptz '2026-07-13 12:01:00+00'),
  ('40000000-0000-0000-0000-00000000000b',
   '40000000-0000-0000-0000-00000000000b', 'all', 'backfill',
   date '2025-01-01', date '2025-12-31', timestamptz '2026-01-01 00:00:00+00',
   'running', 0, timestamptz '2026-07-13 12:02:00+00', null);

insert into staging.raw_premium_txn (
  policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
  agent_id, agent_name, agency, region, txn_code, txn_name, txn_date,
  effective_date, expiration_date, status, written_premium, source_txn_id,
  source_updated_at, source_effective_date, batch_id, ingested_at
) values (
  null, 'AUTO', 'Personal Auto', 'TAP-QUARANTINE-INSURED',
  'pgTAP Quarantine Insured', 'NE', 'Personal', 'TAP-QUARANTINE-AGENT',
  'pgTAP Quarantine Agent', 'pgTAP Agency', 'Central', 'NB', 'New Business',
  date '2025-06-15', date '2025-06-15', date '2026-06-14', 'Active', 1000,
  'tap-quarantine-owner-invariant', timestamptz '2025-06-15 12:00:00+00',
  date '2025-06-15', '40000000-0000-0000-0000-00000000000a',
  timestamptz '2026-07-13 12:00:00+00'
);

insert into ops.quarantine_records (
  quarantine_id, run_id, batch_id, source_name, source_txn_id,
  reason_code, severity, payload, disposition, quarantined_at
) values (
  '40000000-0000-0000-0000-0000000000aa',
  '40000000-0000-0000-0000-00000000000a',
  '40000000-0000-0000-0000-00000000000a',
  'premium', 'tap-quarantine-owner-invariant', 'MISSING_POLICY_NUMBER',
  'critical', '{"fixture":"original-owner"}'::jsonb, 'pending',
  timestamptz '2026-07-13 12:00:30+00'
);

create temporary table tap_fact_snapshot as
select
  (select count(*) from public.fact_premium) as premium_count,
  (select md5(coalesce(string_agg(md5(to_jsonb(f)::text), '' order by f.premium_key), ''))
   from public.fact_premium f) as premium_hash,
  (select count(*) from public.fact_loss) as loss_count,
  (select md5(coalesce(string_agg(md5(to_jsonb(f)::text), '' order by f.loss_key), ''))
   from public.fact_loss f) as loss_hash;

create temporary table tap_watermark_snapshot as
select source_name, watermark_ts, watermark_source_id, last_successful_run_id, updated_at
from ops.etl_watermarks;

create temporary table tap_retry_result as
select private.v2_quarantine_invalid_candidates(
  '40000000-0000-0000-0000-00000000000b'::uuid,
  '40000000-0000-0000-0000-00000000000b'::uuid,
  'backfill', date '2025-01-01', date '2025-12-31',
  timestamptz '2026-01-01 00:00:00+00'
) as rejected_rows;

select ok((select rejected_rows > 0 from tap_retry_result),
  'retry counts the already-pending invalid source as rejected');

select ok(exists (
  select 1
  from ops.quarantine_records
  where source_name = 'premium'
    and source_txn_id = 'tap-quarantine-owner-invariant'
    and disposition = 'pending'
    and run_id = '40000000-0000-0000-0000-00000000000a'
    and batch_id = '40000000-0000-0000-0000-00000000000a'
    and quarantined_at = timestamptz '2026-07-13 12:00:30+00'
), 'pending record retains original run, batch, and quarantine timestamp');

select ok(not exists (
  select 1
  from ops.quarantine_records
  where disposition = 'pending'
    and run_id = '40000000-0000-0000-0000-00000000000b'
), 'retry run does not steal ownership of any pending record');

select is((
  select count(*)::integer
  from ops.quarantine_records
  where source_name = 'premium'
    and source_txn_id = 'tap-quarantine-owner-invariant'
    and disposition = 'pending'
), 1, 'the invalid source keeps exactly one recovery target');

select ok(exists (
  select 1
  from tap_fact_snapshot before
  where before.premium_count = (select count(*) from public.fact_premium)
    and before.premium_hash = (
      select md5(coalesce(string_agg(md5(to_jsonb(f)::text), '' order by f.premium_key), ''))
      from public.fact_premium f
    )
    and before.loss_count = (select count(*) from public.fact_loss)
    and before.loss_hash = (
      select md5(coalesce(string_agg(md5(to_jsonb(f)::text), '' order by f.loss_key), ''))
      from public.fact_loss f
    )
), 'quarantine retry does not mutate premium or loss facts');

select ok(
  not exists (
    (select source_name, watermark_ts, watermark_source_id, last_successful_run_id, updated_at
     from tap_watermark_snapshot
     except
     select source_name, watermark_ts, watermark_source_id, last_successful_run_id, updated_at
     from ops.etl_watermarks)
    union all
    (select source_name, watermark_ts, watermark_source_id, last_successful_run_id, updated_at
     from ops.etl_watermarks
     except
     select source_name, watermark_ts, watermark_source_id, last_successful_run_id, updated_at
     from tap_watermark_snapshot)
  ),
  'quarantine retry does not advance or rewrite ETL watermarks'
);

select * from finish();
rollback;
