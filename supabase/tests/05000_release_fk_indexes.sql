begin;

set local search_path = extensions, public, pg_catalog;

select plan(10);

select has_index('ops', 'etl_watermarks', 'etl_watermarks_last_successful_run_idx',
  'watermark lineage foreign key is indexed');
select has_index('ops', 'pipeline_batches', 'pipeline_batches_run_idx',
  'pipeline batch run foreign key is indexed');
select has_index('ops', 'quarantine_records', 'quarantine_records_batch_idx',
  'quarantine batch foreign key is indexed');
select has_index('ops', 'quarantine_records', 'quarantine_records_recovered_by_run_idx',
  'quarantine recovery foreign key is indexed');
select has_index('public', 'pipeline_runs', 'pipeline_runs_recovered_from_run_idx',
  'pipeline recovery lineage foreign key is indexed');

select ok(i.indisvalid and i.indisready, 'watermark lineage index is valid and ready')
from pg_index i
where i.indexrelid = 'ops.etl_watermarks_last_successful_run_idx'::regclass;
select ok(i.indisvalid and i.indisready, 'pipeline batch run index is valid and ready')
from pg_index i
where i.indexrelid = 'ops.pipeline_batches_run_idx'::regclass;
select ok(i.indisvalid and i.indisready, 'quarantine batch index is valid and ready')
from pg_index i
where i.indexrelid = 'ops.quarantine_records_batch_idx'::regclass;
select ok(i.indisvalid and i.indisready, 'quarantine recovery index is valid and ready')
from pg_index i
where i.indexrelid = 'ops.quarantine_records_recovered_by_run_idx'::regclass;
select ok(i.indisvalid and i.indisready, 'pipeline recovery lineage index is valid and ready')
from pg_index i
where i.indexrelid = 'public.pipeline_runs_recovered_from_run_idx'::regclass;

select * from finish();
rollback;
