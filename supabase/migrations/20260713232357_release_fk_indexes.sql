-- Release hardening: support warehouse-v2 foreign-key joins and cleanup paths.
-- This migration is additive, does not change data or public contracts, and is
-- safe to replay because every index is guarded with IF NOT EXISTS.

create index if not exists etl_watermarks_last_successful_run_idx
  on ops.etl_watermarks (last_successful_run_id);

create index if not exists pipeline_batches_run_idx
  on ops.pipeline_batches (run_id);

create index if not exists quarantine_records_batch_idx
  on ops.quarantine_records (batch_id);

create index if not exists quarantine_records_recovered_by_run_idx
  on ops.quarantine_records (recovered_by_run_id);

create index if not exists pipeline_runs_recovered_from_run_idx
  on public.pipeline_runs (recovered_from_run_id);
