begin;

set local search_path = extensions, public, pg_catalog;

select plan(61);

select has_schema('ops', 'operations schema exists');
select has_table('ops', 'pipeline_batches', 'pipeline batch ledger exists');
select has_table('ops', 'etl_watermarks', 'ETL watermark ledger exists');
select has_table('ops', 'pipeline_stage_runs', 'stage-run evidence exists');
select has_table('ops', 'quarantine_records', 'quarantine evidence exists');

select has_view('public', 'vw_pipeline_stage_runs', 'bounded stage-run view exists');
select has_view('public', 'vw_quarantine_evidence', 'sanitized quarantine view exists');
select has_view('public', 'vw_policy_scd2_evidence', 'bounded SCD2 evidence view exists');
select has_view('public', 'vw_pipeline_runs', 'existing bounded pipeline-run view remains available');

select ok(to_regprocedure('public.run_demo_pipeline()') is not null,
  'legacy demo function remains available');
select ok(to_regprocedure('public.run_demo_pipeline_action(text,uuid)') is not null,
  'service action function has the agreed signature');
select ok(to_regprocedure('public.run_demo_backfill(date,date)') is not null,
  'bounded benchmark backfill has the agreed signature');
select ok(to_regprocedure('private.sp_load_dimensions_v2(uuid,text,date,date,timestamp with time zone)') is not null,
  'v2 dimension loader has the agreed signature');
select ok(to_regprocedure('private.sp_load_facts_v2(uuid,text,date,date,timestamp with time zone,date)') is not null,
  'v2 fact loader has the agreed signature');
select ok(to_regprocedure('private.sp_refresh_earned_premium_v2(uuid,date)') is not null,
  'earned-premium recalculation has the agreed signature');
select ok(to_regprocedure('private.sp_run_data_quality_v2(uuid)') is not null,
  'v2 data-quality function has the agreed signature');
select ok(to_regprocedure('private.run_nico_pipeline_v2(text,text,date,date,text,uuid)') is not null,
  'v2 pipeline orchestrator has the agreed signature');
select ok(to_regprocedure('private.v2_apply_policy_scd2(uuid,text,integer,integer,integer,date,date,text,date,timestamp with time zone)') is not null,
  'SCD2 boundary application has the agreed signature');
select ok(to_regprocedure('private.v2_rekey_policy_facts(text)') is not null,
  'historical fact re-keying has the agreed signature');

select function_returns('public', 'run_demo_pipeline', array[]::text[], 'jsonb',
  'legacy demo function still returns jsonb');
select function_returns('public', 'run_demo_pipeline_action', array['text', 'uuid'], 'jsonb',
  'action function returns jsonb');
select function_returns('public', 'run_demo_backfill', array['date', 'date'], 'jsonb',
  'backfill function returns jsonb');
select is(
  (select pronargdefaults::integer
   from pg_proc
   where oid = to_regprocedure('public.run_demo_pipeline_action(text,uuid)')),
  1,
  'recovery run id is optional'
);

select has_column('public', 'pipeline_runs', 'mode', 'pipeline run records mode');
select has_column('public', 'pipeline_runs', 'scenario', 'pipeline run records scenario');
select has_column('public', 'pipeline_runs', 'watermark_start', 'pipeline run records starting watermark');
select has_column('public', 'pipeline_runs', 'watermark_end', 'pipeline run records ending watermark');
select has_column('public', 'pipeline_runs', 'source_rows', 'pipeline run records source rows');
select has_column('public', 'pipeline_runs', 'inserted_rows', 'pipeline run records inserts');
select has_column('public', 'pipeline_runs', 'updated_rows', 'pipeline run records updates');
select has_column('public', 'pipeline_runs', 'unchanged_rows', 'pipeline run records unchanged rows');
select has_column('public', 'pipeline_runs', 'recalculated_rows', 'pipeline run records recalculations');
select has_column('public', 'pipeline_runs', 'rejected_rows', 'pipeline run records rejects');
select has_column('public', 'pipeline_runs', 'freshness_lag_seconds', 'pipeline run records freshness lag');
select has_column('public', 'pipeline_runs', 'recovered_from_run_id', 'pipeline run records recovery lineage');
select has_column('public', 'dq_results', 'pipeline_run_id', 'DQ evidence links to the pipeline run');

select has_column('staging', 'raw_premium_txn', 'landing_id', 'premium staging has a landing id');
select has_column('staging', 'raw_premium_txn', 'source_txn_id', 'premium staging has a source id');
select has_column('staging', 'raw_premium_txn', 'source_updated_at', 'premium staging has source recency');
select has_column('staging', 'raw_premium_txn', 'source_effective_date', 'premium staging has source-effective date');
select has_column('staging', 'raw_premium_txn', 'batch_id', 'premium staging has batch lineage');
select has_column('staging', 'raw_premium_txn', 'ingested_at', 'premium staging has ingestion time');

select has_column('staging', 'raw_claim_txn', 'landing_id', 'claim staging has a landing id');
select has_column('staging', 'raw_claim_txn', 'source_txn_id', 'claim staging has a source id');
select has_column('staging', 'raw_claim_txn', 'source_updated_at', 'claim staging has source recency');
select has_column('staging', 'raw_claim_txn', 'source_effective_date', 'claim staging has source-effective date');
select has_column('staging', 'raw_claim_txn', 'batch_id', 'claim staging has batch lineage');
select has_column('staging', 'raw_claim_txn', 'ingested_at', 'claim staging has ingestion time');

select has_column('public', 'fact_premium', 'source_txn_id', 'premium fact preserves source id');
select has_column('public', 'fact_premium', 'source_updated_at', 'premium fact preserves source recency');
select has_column('public', 'fact_premium', 'load_batch_id', 'premium fact preserves load batch');
select has_column('public', 'fact_premium', 'loaded_at', 'premium fact records load time');
select has_column('public', 'fact_premium', 'calculation_as_of_date', 'premium fact records calculation date');
select has_column('public', 'fact_loss', 'source_txn_id', 'loss fact preserves source id');
select has_column('public', 'fact_loss', 'source_updated_at', 'loss fact preserves source recency');
select has_column('public', 'fact_loss', 'load_batch_id', 'loss fact preserves load batch');
select has_column('public', 'fact_loss', 'loaded_at', 'loss fact records load time');

select ok(not exists (
  select 1 from unnest(array[
    'batch_id', 'run_id', 'source_name', 'mode', 'requested_from', 'requested_to',
    'cutoff_at', 'status', 'source_rows', 'checksum', 'created_at', 'finished_at'
  ]) required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'ops' and c.table_name = 'pipeline_batches'
      and c.column_name = required.column_name
  )
), 'pipeline batch ledger exposes the agreed evidence fields');

select ok(not exists (
  select 1 from unnest(array[
    'source_name', 'watermark_ts', 'watermark_source_id', 'last_successful_run_id', 'updated_at'
  ]) required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'ops' and c.table_name = 'etl_watermarks'
      and c.column_name = required.column_name
  )
), 'watermark ledger exposes the agreed lineage fields');

select ok(not exists (
  select 1 from unnest(array[
    'stage_run_id', 'run_id', 'stage_order', 'stage_name', 'status', 'started_at',
    'finished_at', 'duration_ms', 'input_rows', 'inserted_rows', 'updated_rows',
    'unchanged_rows', 'recalculated_rows', 'rejected_rows', 'error_code', 'sanitized_error'
  ]) required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'ops' and c.table_name = 'pipeline_stage_runs'
      and c.column_name = required.column_name
  )
), 'stage-run ledger exposes the agreed observability fields');

select ok(not exists (
  select 1 from unnest(array[
    'quarantine_id', 'run_id', 'batch_id', 'source_name', 'source_txn_id', 'reason_code',
    'severity', 'payload', 'disposition', 'quarantined_at', 'resolved_at', 'recovered_by_run_id'
  ]) required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'ops' and c.table_name = 'quarantine_records'
      and c.column_name = required.column_name
  )
), 'quarantine ledger exposes evidence while retaining its private payload');

select * from finish();
rollback;
