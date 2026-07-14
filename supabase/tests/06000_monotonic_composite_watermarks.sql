begin;

set local search_path = extensions, public, pg_catalog;

select plan(8);

insert into public.pipeline_runs (
  run_id, trigger_type, started_at, finished_at, status, mode
) values
  ('60000000-0000-0000-0000-00000000000a', 'manual',
   timestamptz '2026-07-13 13:00:00+00', timestamptz '2026-07-13 13:00:01+00',
   'success', 'incremental'),
  ('60000000-0000-0000-0000-00000000000b', 'manual',
   timestamptz '2026-07-13 13:01:00+00', timestamptz '2026-07-13 13:01:01+00',
   'success', 'incremental'),
  ('60000000-0000-0000-0000-00000000000c', 'manual',
   timestamptz '2026-07-13 13:02:00+00', timestamptz '2026-07-13 13:02:01+00',
   'success', 'incremental');

-- Reproduce the hosted edge case: both source ledgers are seeded beyond the
-- current cutoff, so the incremental run sees no eligible source rows.
update ops.etl_watermarks
set watermark_ts = timestamptz '2099-12-31 00:00:00+00',
    watermark_source_id = case source_name
      when 'premium' then 'tap-future-premium'
      else 'tap-future-claim'
    end,
    last_successful_run_id = '60000000-0000-0000-0000-00000000000a',
    updated_at = timestamptz '2026-07-13 13:00:01+00';

create temporary table tap_future_watermarks as
select source_name, watermark_ts, watermark_source_id,
  last_successful_run_id, updated_at
from ops.etl_watermarks;

create temporary table tap_zero_source_run as
select private.run_nico_pipeline_v2(
  'manual', 'incremental', null, null, null, null
) as run_id;

select is((
  select status from public.pipeline_runs
  where run_id = (select run_id from tap_zero_source_run)
), 'success', 'future-seeded zero-source incremental run succeeds');

select is((
  select source_rows from public.pipeline_runs
  where run_id = (select run_id from tap_zero_source_run)
), 0, 'future-seeded incremental run selects zero source rows');

select ok(exists (
  select 1 from public.pipeline_runs
  where run_id = (select run_id from tap_zero_source_run)
    and inserted_rows = 0
    and updated_rows = 0
    and recalculated_rows = 0
    and rejected_rows = 0
), 'zero-source incremental run publishes no data mutations');

select ok(not exists (
  (select source_name, watermark_ts, watermark_source_id,
      last_successful_run_id, updated_at
   from tap_future_watermarks
   except
   select source_name, watermark_ts, watermark_source_id,
      last_successful_run_id, updated_at
   from ops.etl_watermarks)
  union all
  (select source_name, watermark_ts, watermark_source_id,
      last_successful_run_id, updated_at
   from ops.etl_watermarks
   except
   select source_name, watermark_ts, watermark_source_id,
      last_successful_run_id, updated_at
   from tap_future_watermarks)
), 'zero-source run preserves composite watermarks and prior lineage');

select ok(exists (
  select 1 from public.pipeline_runs
  where run_id = (select run_id from tap_zero_source_run)
    and watermark_start = watermark_end
), 'zero-source run records identical starting and ending watermarks');

-- Composite ordering uses source ID as the deterministic tiebreaker.
update ops.etl_watermarks
set watermark_ts = timestamptz '2100-01-01 00:00:00+00',
    watermark_source_id = 'tap-tie-m',
    last_successful_run_id = '60000000-0000-0000-0000-00000000000a',
    updated_at = timestamptz '2026-07-13 13:03:00+00'
where source_name = 'premium';

update ops.etl_watermarks
set watermark_source_id = 'tap-tie-a',
    last_successful_run_id = '60000000-0000-0000-0000-00000000000b',
    updated_at = timestamptz '2026-07-13 13:04:00+00'
where source_name = 'premium';

select ok(exists (
  select 1 from ops.etl_watermarks
  where source_name = 'premium'
    and watermark_ts = timestamptz '2100-01-01 00:00:00+00'
    and watermark_source_id = 'tap-tie-m'
    and last_successful_run_id = '60000000-0000-0000-0000-00000000000a'
    and updated_at = timestamptz '2026-07-13 13:03:00+00'
), 'lower source ID at the same timestamp cannot rewind cursor or lineage');

update ops.etl_watermarks
set watermark_source_id = 'tap-tie-m',
    last_successful_run_id = '60000000-0000-0000-0000-00000000000b',
    updated_at = timestamptz '2026-07-13 13:04:30+00'
where source_name = 'premium';

select ok(exists (
  select 1 from ops.etl_watermarks
  where source_name = 'premium'
    and watermark_ts = timestamptz '2100-01-01 00:00:00+00'
    and watermark_source_id = 'tap-tie-m'
    and last_successful_run_id = '60000000-0000-0000-0000-00000000000a'
    and updated_at = timestamptz '2026-07-13 13:03:00+00'
), 'equal composite is a no-op for lineage and update timestamp');

update ops.etl_watermarks
set watermark_source_id = 'tap-tie-z',
    last_successful_run_id = '60000000-0000-0000-0000-00000000000c',
    updated_at = timestamptz '2026-07-13 13:05:00+00'
where source_name = 'premium';

select ok(exists (
  select 1 from ops.etl_watermarks
  where source_name = 'premium'
    and watermark_ts = timestamptz '2100-01-01 00:00:00+00'
    and watermark_source_id = 'tap-tie-z'
    and last_successful_run_id = '60000000-0000-0000-0000-00000000000c'
    and updated_at = timestamptz '2026-07-13 13:05:00+00'
), 'higher source ID at the same timestamp advances cursor and lineage');

select * from finish();
rollback;
