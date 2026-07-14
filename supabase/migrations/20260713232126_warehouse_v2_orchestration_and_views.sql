-- Warehouse v2 orchestration, controlled failure/recovery actions, operational
-- evidence, compatibility RPCs, scheduling, and bounded browser views.

create or replace function private.v2_quarantine_invalid_candidates(
  p_run_id uuid,
  p_batch_id uuid,
  p_mode text,
  p_from date,
  p_to date,
  p_cutoff timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer := 0;
  v_claim_rows integer := 0;
begin
  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), invalid as (
    select * from ranked
    where source_rank = 1 and (
      policy_number is null or lob_code is null or insured_id is null
      or agent_id is null or txn_code is null or txn_date is null
      or effective_date is null or expiration_date is null
      or expiration_date <= effective_date or written_premium is null
      or (written_premium < 0 and txn_code <> 'CN')
    )
  )
  insert into ops.quarantine_records (
    run_id, batch_id, source_name, source_txn_id,
    reason_code, severity, payload
  )
  select p_run_id, p_batch_id, 'premium', source_txn_id,
    case
      when policy_number is null then 'MISSING_POLICY_NUMBER'
      when expiration_date <= effective_date then 'INVALID_POLICY_TERM'
      when written_premium < 0 and txn_code <> 'CN' then 'UNEXPECTED_NEGATIVE_PREMIUM'
      else 'MISSING_REQUIRED_PREMIUM_FIELD'
    end,
    'critical', to_jsonb(invalid) - 'landing_id'
  from invalid
  on conflict (source_name, source_txn_id) where disposition = 'pending'
  -- A retry must count the rejection without stealing the pending record from
  -- the controlled-failure run that owns its recovery lineage.
  do update set reason_code = quarantine_records.reason_code;

  get diagnostics v_rows = row_count;

  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_claim_txn s
    where private.v2_source_row_in_scope(
      'claim', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), invalid as (
    select s.*
    from ranked s
    where s.source_rank = 1 and (
      s.claim_number is null or s.policy_number is null or s.lob_code is null
      or s.txn_code is null or s.txn_date is null or s.effective_date is null
      or (s.paid_loss is null and s.case_reserve is null)
      or (
        not exists (
          select 1 from public.dim_policy p
          where p.policy_number = s.policy_number
            and s.txn_date >= p.valid_from
            and (p.valid_to is null or s.txn_date < p.valid_to)
        )
        and not exists (
          -- A policy snapshot arriving in the same batch is not an error: the
          -- dimensions stage runs before facts and will establish its version.
          select 1 from staging.raw_premium_txn premium
          where premium.policy_number = s.policy_number
            and premium.policy_number is not null
            and premium.effective_date <= s.txn_date
            and premium.expiration_date >= s.txn_date
        )
      )
    )
  )
  insert into ops.quarantine_records (
    run_id, batch_id, source_name, source_txn_id,
    reason_code, severity, payload
  )
  select p_run_id, p_batch_id, 'claim', source_txn_id,
    case
      when policy_number is null then 'MISSING_POLICY_NUMBER'
      when not exists (
        select 1 from public.dim_policy p
        where p.policy_number = invalid.policy_number
          and invalid.txn_date >= p.valid_from
          and (p.valid_to is null or invalid.txn_date < p.valid_to)
      ) and not exists (
        select 1 from staging.raw_premium_txn premium
        where premium.policy_number = invalid.policy_number
          and premium.policy_number is not null
          and premium.effective_date <= invalid.txn_date
          and premium.expiration_date >= invalid.txn_date
      ) then 'LATE_ARRIVING_POLICY'
      else 'MISSING_REQUIRED_CLAIM_FIELD'
    end,
    'critical', to_jsonb(invalid) - 'landing_id'
  from invalid
  on conflict (source_name, source_txn_id) where disposition = 'pending'
  do update set reason_code = quarantine_records.reason_code;

  get diagnostics v_claim_rows = row_count;
  return v_rows + v_claim_rows;
end;
$$;

revoke all on function private.v2_quarantine_invalid_candidates(
  uuid, uuid, text, date, date, timestamptz
) from public, anon, authenticated;

create or replace function private.run_nico_pipeline_v2(
  p_trigger text,
  p_mode text,
  p_from date,
  p_to date,
  p_scenario text,
  p_recover_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_cutoff timestamptz;
  -- Backfill results must be reproducible for their declared window; live
  -- incremental runs continue to calculate earned premium as of today.
  v_as_of_date date := case when p_mode = 'backfill' then p_to else current_date end;
  v_started timestamptz := clock_timestamp();
  v_stage_started timestamptz;
  v_stage_finished timestamptz;
  v_dq_run_id uuid;
  v_dimensions jsonb := '{}'::jsonb;
  v_facts jsonb := '{}'::jsonb;
  v_refresh jsonb := '{}'::jsonb;
  v_watermark_start jsonb;
  v_watermark_end jsonb;
  v_source_rows integer := 0;
  v_rejected integer := 0;
  v_checks_total integer := 0;
  v_checks_passed integer := 0;
  v_failed_stage smallint;
  v_error_code text;
  v_error_message text;
  v_premium_ts timestamptz;
  v_premium_id text;
  v_claim_ts timestamptz;
  v_claim_id text;
  v_pending ops.quarantine_records%rowtype;
  v_source staging.raw_premium_txn%rowtype;
  v_duration_dimensions integer := 0;
  v_duration_facts integer := 0;
  v_duration_refresh integer := 0;
  v_duration_dq integer := 0;
begin
  if p_trigger not in ('manual', 'scheduled') then
    raise exception using errcode = '22023', message = 'Unsupported pipeline trigger';
  end if;
  if p_mode not in ('incremental', 'backfill') then
    raise exception using errcode = '22023', message = 'Unsupported pipeline mode';
  end if;
  if p_mode = 'backfill' and (
    p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366
  ) then
    raise exception using errcode = '22023',
      message = 'Backfill requires an ordered date range of 366 days or fewer';
  end if;
  if p_scenario not in ('controlled-failure', 'recovery') and p_scenario is not null then
    raise exception using errcode = '22023', message = 'Unsupported pipeline scenario';
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtext('nico-pc-warehouse-pipeline')
  ) then
    insert into public.pipeline_runs (
      run_id, trigger_type, started_at, finished_at, status,
      duration_ms, error_message, mode, scenario
    ) values (
      v_run_id, p_trigger, v_started, clock_timestamp(), 'cooldown', 0,
      'Another synthetic warehouse run is already active.', p_mode, p_scenario
    );
    return v_run_id;
  end if;

  select jsonb_object_agg(
    source_name,
    jsonb_build_object('timestamp', watermark_ts, 'sourceId', watermark_source_id)
  ) into v_watermark_start
  from ops.etl_watermarks;

  insert into public.pipeline_runs (
    run_id, trigger_type, started_at, status, mode, scenario,
    watermark_start, recovered_from_run_id
  ) values (
    v_run_id, p_trigger, v_started, 'running', p_mode, p_scenario,
    v_watermark_start,
    case when p_scenario = 'recovery' then p_recover_run_id else null end
  );

  insert into ops.pipeline_batches (
    batch_id, run_id, source_name, mode, requested_from, requested_to,
    status, created_at
  ) values (
    v_run_id, v_run_id, 'all',
    case when p_scenario is null then p_mode else 'demo' end,
    p_from, p_to, 'running', v_started
  );

  if p_scenario = 'controlled-failure' then
    select * into v_source
    from staging.raw_premium_txn
    where policy_number is not null
    order by source_txn_id, source_updated_at desc, landing_id desc
    limit 1;

    if not found then
      raise exception using errcode = 'P0001',
        message = 'No synthetic premium source row is available for the controlled scenario';
    end if;

    insert into staging.raw_premium_txn (
      policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
      agent_id, agent_name, agency, region, txn_code, txn_name,
      txn_date, effective_date, expiration_date, status, written_premium,
      source_txn_id, source_updated_at, source_effective_date, batch_id, ingested_at
    ) values (
      null, v_source.lob_code, v_source.lob_name,
      v_source.insured_id, v_source.insured_name, v_source.state, v_source.segment,
      v_source.agent_id, v_source.agent_name, v_source.agency, v_source.region,
      v_source.txn_code, v_source.txn_name, v_source.txn_date,
      v_source.effective_date, v_source.expiration_date, v_source.status,
      v_source.written_premium, v_source.source_txn_id, clock_timestamp(),
      v_source.source_effective_date, v_run_id, clock_timestamp()
    );
  elsif p_scenario = 'recovery' then
    select * into v_pending
    from ops.quarantine_records
    where run_id = p_recover_run_id
      and source_name = 'premium'
      and disposition = 'pending'
    order by quarantined_at desc
    limit 1
    for update;

    if not found then
      raise exception using errcode = '22023',
        message = 'The requested run has no recoverable synthetic premium record';
    end if;

    select * into v_source
    from staging.raw_premium_txn
    where source_txn_id = v_pending.source_txn_id
      and policy_number is not null
    order by source_updated_at desc, landing_id desc
    limit 1;

    if not found then
      raise exception using errcode = 'P0001',
        message = 'The recoverable source record has no prior valid version';
    end if;

    insert into staging.raw_premium_txn (
      policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
      agent_id, agent_name, agency, region, txn_code, txn_name,
      txn_date, effective_date, expiration_date, status, written_premium,
      source_txn_id, source_updated_at, source_effective_date, batch_id, ingested_at
    ) values (
      v_source.policy_number, v_source.lob_code, v_source.lob_name,
      v_source.insured_id, v_source.insured_name, v_source.state, v_source.segment,
      v_source.agent_id, v_source.agent_name, v_source.agency, v_source.region,
      v_source.txn_code, v_source.txn_name, v_source.txn_date,
      v_source.effective_date, v_source.expiration_date, v_source.status,
      v_source.written_premium, v_source.source_txn_id, clock_timestamp(),
      v_source.source_effective_date, v_run_id, clock_timestamp()
    );
  end if;

  v_cutoff := clock_timestamp();
  update ops.pipeline_batches set cutoff_at = v_cutoff where batch_id = v_run_id;

  select count(*)::integer into v_source_rows
  from (
    select source_txn_id from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, v_cutoff
    )
    union all
    select source_txn_id from staging.raw_claim_txn s
    where private.v2_source_row_in_scope(
      'claim', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, v_cutoff
    )
  ) scoped;

  insert into ops.pipeline_stage_runs (
    run_id, stage_order, stage_name, status, started_at, finished_at,
    duration_ms, input_rows
  ) values (
    v_run_id, 10, 'ingest_select', 'success', v_started, clock_timestamp(),
    greatest(1, round(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer),
    v_source_rows
  );

  v_stage_started := clock_timestamp();
  v_rejected := private.v2_quarantine_invalid_candidates(
    v_run_id, v_run_id, p_mode, p_from, p_to, v_cutoff
  );
  v_stage_finished := clock_timestamp();

  if v_rejected > 0 then
    insert into ops.pipeline_stage_runs (
      run_id, stage_order, stage_name, status, started_at, finished_at,
      duration_ms, input_rows, rejected_rows, error_code, sanitized_error
    ) values (
      v_run_id, 20, 'validate_dedupe', 'failed', v_stage_started,
      v_stage_finished,
      greatest(1, round(extract(epoch from (v_stage_finished - v_stage_started)) * 1000)::integer),
      v_source_rows, v_rejected, 'SOURCE_VALIDATION_FAILED',
      'One or more synthetic source records were quarantined.'
    );

    insert into ops.pipeline_stage_runs (
      run_id, stage_order, stage_name, status, started_at, finished_at,
      duration_ms, sanitized_error
    )
    select v_run_id, stage_order, stage_name, 'skipped', clock_timestamp(),
      clock_timestamp(), 0, 'Skipped after source validation failed.'
    from (values
      (30::smallint, 'dimensions_scd2'),
      (40::smallint, 'facts_incremental'),
      (50::smallint, 'earned_premium_refresh'),
      (60::smallint, 'data_quality_gate'),
      (70::smallint, 'publish_watermark')
    ) stages(stage_order, stage_name);

    update public.pipeline_runs
    set finished_at = clock_timestamp(),
        status = 'failed',
        duration_ms = greatest(1, round(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer),
        source_rows = v_source_rows,
        rejected_rows = v_rejected,
        premium_rows = (select count(*) from public.fact_premium),
        loss_rows = (select count(*) from public.fact_loss),
        error_message = 'Synthetic source validation failed; published data was unchanged.'
    where run_id = v_run_id;

    update ops.pipeline_batches
    set status = 'failed', source_rows = v_source_rows,
        finished_at = clock_timestamp()
    where batch_id = v_run_id;
    return v_run_id;
  end if;

  insert into ops.pipeline_stage_runs (
    run_id, stage_order, stage_name, status, started_at, finished_at,
    duration_ms, input_rows, rejected_rows
  ) values (
    v_run_id, 20, 'validate_dedupe', 'success', v_stage_started,
    v_stage_finished,
    greatest(1, round(extract(epoch from (v_stage_finished - v_stage_started)) * 1000)::integer),
    v_source_rows, 0
  );

  begin
    v_failed_stage := 30;
    v_stage_started := clock_timestamp();
    v_dimensions := private.sp_load_dimensions_v2(
      v_run_id, p_mode, p_from, p_to, v_cutoff
    );
    v_duration_dimensions := greatest(1, round(extract(epoch from
      (clock_timestamp() - v_stage_started)) * 1000)::integer);

    v_failed_stage := 40;
    v_stage_started := clock_timestamp();
    v_facts := private.sp_load_facts_v2(
      v_run_id, p_mode, p_from, p_to, v_cutoff, v_as_of_date
    );
    v_duration_facts := greatest(1, round(extract(epoch from
      (clock_timestamp() - v_stage_started)) * 1000)::integer);

    v_failed_stage := 50;
    v_stage_started := clock_timestamp();
    v_refresh := private.sp_refresh_earned_premium_v2(v_run_id, v_as_of_date);
    v_duration_refresh := greatest(1, round(extract(epoch from
      (clock_timestamp() - v_stage_started)) * 1000)::integer);

    v_failed_stage := 60;
    v_stage_started := clock_timestamp();
    v_dq_run_id := private.sp_run_data_quality_v2(v_run_id);
    select count(*)::integer,
      count(*) filter (where status = 'pass')::integer
    into v_checks_total, v_checks_passed
    from public.dq_results
    where run_id = v_dq_run_id;
    v_duration_dq := greatest(1, round(extract(epoch from
      (clock_timestamp() - v_stage_started)) * 1000)::integer);

    if v_checks_total <> 6 or v_checks_passed <> 6 then
      raise exception using errcode = 'P0001', message = 'Data quality gate failed';
    end if;
  exception when others then
    v_error_code := sqlstate;
    v_error_message := case
      when sqlstate = 'P0001' and sqlerrm = 'Data quality gate failed'
        then 'Data quality gate failed.'
      else 'Pipeline stage failed (' || sqlstate || ').'
    end;
  end;

  if v_error_code is not null then
    insert into ops.pipeline_stage_runs (
      run_id, stage_order, stage_name, status, started_at, finished_at,
      duration_ms, input_rows, inserted_rows, updated_rows, unchanged_rows,
      recalculated_rows, error_code, sanitized_error
    )
    select v_run_id, s.stage_order, s.stage_name,
      case
        when s.stage_order < v_failed_stage then 'success'
        when s.stage_order = v_failed_stage then 'failed'
        else 'skipped'
      end,
      clock_timestamp(), clock_timestamp(),
      case s.stage_order
        when 30 then v_duration_dimensions
        when 40 then v_duration_facts
        when 50 then v_duration_refresh
        when 60 then v_duration_dq
        else 0
      end,
      case s.stage_order
        when 30 then coalesce((v_dimensions->>'input')::integer,0)
        when 40 then coalesce((v_facts->>'input')::integer,0)
        else 0
      end,
      case s.stage_order
        when 30 then coalesce((v_dimensions->>'inserted')::integer,0)
        when 40 then coalesce((v_facts->>'inserted')::integer,0)
        else 0
      end,
      case s.stage_order
        when 30 then coalesce((v_dimensions->>'updated')::integer,0)
        when 40 then coalesce((v_facts->>'updated')::integer,0)
        else 0
      end,
      case s.stage_order
        when 30 then coalesce((v_dimensions->>'unchanged')::integer,0)
        when 40 then coalesce((v_facts->>'unchanged')::integer,0)
        else 0
      end,
      case when s.stage_order = 50
        then coalesce((v_refresh->>'recalculated')::integer,0) else 0 end,
      case when s.stage_order = v_failed_stage then v_error_code else null end,
      case
        when s.stage_order = v_failed_stage then v_error_message
        when s.stage_order > v_failed_stage then 'Skipped after an earlier stage failed.'
        else null
      end
    from (values
      (30::smallint, 'dimensions_scd2'),
      (40::smallint, 'facts_incremental'),
      (50::smallint, 'earned_premium_refresh'),
      (60::smallint, 'data_quality_gate'),
      (70::smallint, 'publish_watermark')
    ) s(stage_order, stage_name);

    update public.pipeline_runs
    set finished_at = clock_timestamp(),
        status = 'failed',
        duration_ms = greatest(1, round(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer),
        source_rows = v_source_rows,
        rejected_rows = v_rejected,
        premium_rows = (select count(*) from public.fact_premium),
        loss_rows = (select count(*) from public.fact_loss),
        error_message = v_error_message
    where run_id = v_run_id;

    update ops.pipeline_batches
    set status = 'failed', source_rows = v_source_rows,
        finished_at = clock_timestamp()
    where batch_id = v_run_id;
    return v_run_id;
  end if;

  insert into ops.pipeline_stage_runs (
    run_id, stage_order, stage_name, status, started_at, finished_at,
    duration_ms, input_rows, inserted_rows, updated_rows, unchanged_rows,
    recalculated_rows
  ) values
    (v_run_id, 30, 'dimensions_scd2', 'success', v_started, clock_timestamp(),
      v_duration_dimensions, coalesce((v_dimensions->>'input')::integer,0),
      coalesce((v_dimensions->>'inserted')::integer,0),
      coalesce((v_dimensions->>'updated')::integer,0),
      coalesce((v_dimensions->>'unchanged')::integer,0), 0),
    (v_run_id, 40, 'facts_incremental', 'success', v_started, clock_timestamp(),
      v_duration_facts, coalesce((v_facts->>'input')::integer,0),
      coalesce((v_facts->>'inserted')::integer,0),
      coalesce((v_facts->>'updated')::integer,0),
      coalesce((v_facts->>'unchanged')::integer,0), 0),
    (v_run_id, 50, 'earned_premium_refresh', 'success', v_started, clock_timestamp(),
      v_duration_refresh, 0, 0, 0, 0,
      coalesce((v_refresh->>'recalculated')::integer,0)),
    (v_run_id, 60, 'data_quality_gate', 'success', v_started, clock_timestamp(),
      v_duration_dq, 6, 0, 0, 0, 0);

  if p_mode = 'incremental' then
    select source_updated_at, source_txn_id
    into v_premium_ts, v_premium_id
    from staging.raw_premium_txn
    where source_updated_at <= v_cutoff
    order by source_updated_at desc, source_txn_id desc
    limit 1;

    select source_updated_at, source_txn_id
    into v_claim_ts, v_claim_id
    from staging.raw_claim_txn
    where source_updated_at <= v_cutoff
    order by source_updated_at desc, source_txn_id desc
    limit 1;

    if v_premium_ts is not null then
      update ops.etl_watermarks
      set watermark_ts = v_premium_ts,
          watermark_source_id = v_premium_id,
          last_successful_run_id = v_run_id,
          updated_at = clock_timestamp()
      where source_name = 'premium';
    end if;
    if v_claim_ts is not null then
      update ops.etl_watermarks
      set watermark_ts = v_claim_ts,
          watermark_source_id = v_claim_id,
          last_successful_run_id = v_run_id,
          updated_at = clock_timestamp()
      where source_name = 'claim';
    end if;
  end if;

  select jsonb_object_agg(
    source_name,
    jsonb_build_object('timestamp', watermark_ts, 'sourceId', watermark_source_id)
  ) into v_watermark_end
  from ops.etl_watermarks;

  insert into ops.pipeline_stage_runs (
    run_id, stage_order, stage_name, status, started_at, finished_at, duration_ms
  ) values (
    v_run_id, 70, 'publish_watermark', 'success', clock_timestamp(),
    clock_timestamp(), 1
  );

  if p_scenario = 'recovery' then
    update ops.quarantine_records
    set disposition = 'replayed', resolved_at = clock_timestamp(),
        recovered_by_run_id = v_run_id
    where run_id = p_recover_run_id and disposition = 'pending';
  end if;

  update public.pipeline_runs
  set finished_at = clock_timestamp(),
      status = 'success',
      duration_ms = greatest(1, round(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer),
      premium_rows = (select count(*) from public.fact_premium),
      loss_rows = (select count(*) from public.fact_loss),
      dq_run_id = v_dq_run_id,
      checks_passed = v_checks_passed,
      checks_total = v_checks_total,
      watermark_end = v_watermark_end,
      source_rows = v_source_rows,
      inserted_rows = coalesce((v_dimensions->>'inserted')::integer,0) +
                      coalesce((v_facts->>'inserted')::integer,0),
      updated_rows = coalesce((v_dimensions->>'updated')::integer,0) +
                     coalesce((v_facts->>'updated')::integer,0),
      unchanged_rows = coalesce((v_dimensions->>'unchanged')::integer,0) +
                       coalesce((v_facts->>'unchanged')::integer,0),
      recalculated_rows = coalesce((v_refresh->>'recalculated')::integer,0),
      rejected_rows = 0,
      freshness_lag_seconds = case
        when p_mode = 'incremental' and (v_premium_ts is not null or v_claim_ts is not null)
        then greatest(0, extract(epoch from (
          v_cutoff - greatest(
            coalesce(v_premium_ts, v_claim_ts),
            coalesce(v_claim_ts, v_premium_ts)
          )
        ))::integer)
        else null
      end
  where run_id = v_run_id;

  update ops.pipeline_batches
  set status = 'success', source_rows = v_source_rows,
      finished_at = clock_timestamp(),
      checksum = md5(concat_ws('|', v_source_rows::text,
        coalesce((v_facts->>'inserted'),'0'),
        coalesce((v_facts->>'updated'),'0'),
        v_checks_passed::text))
  where batch_id = v_run_id;

  return v_run_id;
end;
$$;

revoke all on function private.run_nico_pipeline_v2(
  text, text, date, date, text, uuid
) from public, anon, authenticated;

create or replace function public.run_demo_pipeline()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_run uuid;
  v_run_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nico-pc-warehouse-pipeline')
  );

  select run_id into v_previous_run
  from public.pipeline_runs
  where trigger_type = 'manual'
    and scenario is null
    and coalesce(mode, 'full') in ('full', 'incremental')
    and started_at > clock_timestamp() - interval '5 minutes'
  order by started_at desc
  limit 1;

  if v_previous_run is not null then
    return jsonb_build_object('run_id', v_previous_run, 'accepted', false);
  end if;

  v_run_id := private.run_nico_pipeline_v2(
    'manual', 'incremental', null, null, null, null
  );
  return jsonb_build_object('run_id', v_run_id, 'accepted', true);
end;
$$;

revoke all on function public.run_demo_pipeline() from public, anon, authenticated;
grant execute on function public.run_demo_pipeline() to service_role;

create or replace function public.run_demo_pipeline_action(
  p_action text,
  p_recovery_run_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_run uuid;
  v_run_id uuid;
begin
  if p_action not in ('run', 'simulate-failure', 'recover') then
    raise exception using errcode = '22023', message = 'Unsupported demo action';
  end if;
  if p_action = 'run' then
    return public.run_demo_pipeline();
  end if;
  if p_action = 'recover' and p_recovery_run_id is null then
    raise exception using errcode = '22023', message = 'Recovery run ID is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nico-pc-warehouse-pipeline')
  );

  if p_action = 'simulate-failure' then
    -- An unresolved controlled failure remains the single recovery target even
    -- after the time-based cooldown expires.
    select q.run_id into v_previous_run
    from ops.quarantine_records q
    join public.pipeline_runs r on r.run_id = q.run_id
    where q.disposition = 'pending'
      and r.scenario = 'controlled-failure'
    order by q.quarantined_at desc
    limit 1;
    if v_previous_run is not null then
      return jsonb_build_object('run_id', v_previous_run, 'accepted', false);
    end if;

    select run_id into v_previous_run
    from public.pipeline_runs
    where trigger_type = 'manual'
      and scenario = 'controlled-failure'
      and started_at > clock_timestamp() - interval '15 minutes'
    order by started_at desc
    limit 1;
    if v_previous_run is not null then
      return jsonb_build_object('run_id', v_previous_run, 'accepted', false);
    end if;
  end if;

  v_run_id := private.run_nico_pipeline_v2(
    'manual', 'incremental', null, null,
    case when p_action = 'simulate-failure' then 'controlled-failure'
         else 'recovery' end,
    p_recovery_run_id
  );
  return jsonb_build_object('run_id', v_run_id, 'accepted', true);
end;
$$;

revoke all on function public.run_demo_pipeline_action(text, uuid)
from public, anon, authenticated;
grant execute on function public.run_demo_pipeline_action(text, uuid) to service_role;

create or replace function public.run_demo_backfill(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception using errcode = '22023',
      message = 'Backfill requires an ordered date range of 366 days or fewer';
  end if;
  v_run_id := private.run_nico_pipeline_v2(
    'manual', 'backfill', p_from, p_to, null, null
  );
  return jsonb_build_object('run_id', v_run_id, 'accepted', true);
end;
$$;

revoke all on function public.run_demo_backfill(date, date)
from public, anon, authenticated;
grant execute on function public.run_demo_backfill(date, date) to service_role;

-- Preserve the nightly schedule while routing it through the incremental v2 path.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'nico-nightly-warehouse-refresh';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'nico-nightly-warehouse-refresh',
    '15 6 * * *',
    $job$select private.run_nico_pipeline_v2(
      'scheduled', 'incremental', null, null, null, null
    );$job$
  );
end;
$$;

-- Keep policy_count stable after SCD2 begins to create historical versions.
create or replace view private.analytics_kpi_summary
with (security_barrier = true) as
select
  (select coalesce(sum(written_premium), 0) from public.fact_premium) as written_premium,
  (select coalesce(sum(earned_premium), 0) from public.fact_premium) as earned_premium,
  (select coalesce(sum(unearned_premium), 0) from public.fact_premium) as unearned_premium,
  (select coalesce(sum(incurred_loss), 0) from public.fact_loss) as incurred_loss,
  (select coalesce(sum(paid_loss), 0) from public.fact_loss) as paid_loss,
  (select coalesce(sum(case_reserve), 0) from public.fact_loss) as open_reserves,
  (select count(*) from public.dim_policy where is_current) as policy_count,
  (select count(distinct claim_number) from public.fact_loss) as claim_count,
  round(
    100 * (select coalesce(sum(incurred_loss), 0) from public.fact_loss)
      / nullif((select sum(written_premium) from public.fact_premium), 0),
    1
  ) as loss_ratio_pct;

create or replace view private.analytics_pipeline_runs
with (security_barrier = true) as
select run_id, trigger_type, started_at, finished_at, status, duration_ms,
  premium_rows, loss_rows, dq_run_id, checks_passed, checks_total, error_message,
  mode, scenario, watermark_start, watermark_end, source_rows, inserted_rows,
  updated_rows, unchanged_rows, recalculated_rows, rejected_rows,
  freshness_lag_seconds, recovered_from_run_id
from public.pipeline_runs
order by started_at desc
limit 14;

create or replace view private.analytics_pipeline_stage_runs
with (security_barrier = true) as
select s.run_id, s.stage_order, s.stage_name, s.status,
  s.started_at, s.finished_at, s.duration_ms, s.input_rows,
  s.inserted_rows, s.updated_rows, s.unchanged_rows,
  s.recalculated_rows, s.rejected_rows, s.error_code, s.sanitized_error
from ops.pipeline_stage_runs s
where s.run_id in (
  select run_id from public.pipeline_runs order by started_at desc limit 14
)
order by s.run_id, s.stage_order;

create or replace view private.analytics_quarantine_evidence
with (security_barrier = true) as
select q.quarantine_id, q.run_id, q.source_name, q.reason_code,
  q.severity, q.disposition, q.quarantined_at, q.resolved_at,
  q.recovered_by_run_id
from ops.quarantine_records q
order by q.quarantined_at desc
limit 20;

create or replace view private.analytics_policy_scd2_evidence
with (security_barrier = true) as
select policy_key, policy_number, effective_date, expiration_date, status,
  valid_from, valid_to, is_current, source_updated_at,
  created_run_id, updated_run_id
from public.dim_policy
order by source_updated_at desc, policy_number, valid_from desc
limit 50;

create or replace view public.vw_kpi_summary
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_kpi_summary;

create or replace view public.vw_pipeline_runs
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_pipeline_runs;

create or replace view public.vw_pipeline_stage_runs
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_pipeline_stage_runs;

create or replace view public.vw_quarantine_evidence
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_quarantine_evidence;

create or replace view public.vw_policy_scd2_evidence
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_policy_scd2_evidence;

revoke all on all tables in schema ops from public, anon, authenticated;
revoke all on all sequences in schema ops from public, anon, authenticated;
revoke all on schema ops, staging from public, anon, authenticated;
revoke all on all tables in schema staging from public, anon, authenticated;
revoke all on all sequences in schema staging from public, anon, authenticated;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all privileges on all tables in schema private from public, anon, authenticated;

grant usage on schema private to anon, authenticated, service_role;
grant select on
  private.analytics_kpi_summary,
  private.analytics_loss_ratio_by_lob,
  private.analytics_premium_trend_monthly,
  private.analytics_loss_trend_monthly,
  private.analytics_top_agents,
  private.analytics_state_premium,
  private.analytics_data_quality_latest,
  private.analytics_warehouse_objects,
  private.analytics_pipeline_runs,
  private.analytics_pipeline_stage_runs,
  private.analytics_quarantine_evidence,
  private.analytics_policy_scd2_evidence
to anon, authenticated, service_role;

grant select on
  public.vw_kpi_summary,
  public.vw_loss_ratio_by_lob,
  public.vw_premium_trend_monthly,
  public.vw_loss_trend_monthly,
  public.vw_top_agents,
  public.vw_state_premium,
  public.vw_data_quality_latest,
  public.vw_warehouse_objects,
  public.vw_pipeline_runs,
  public.vw_pipeline_stage_runs,
  public.vw_quarantine_evidence,
  public.vw_policy_scd2_evidence
to anon, authenticated, service_role;

grant usage on schema ops, staging to service_role;
grant all on all tables in schema ops, staging to service_role;
grant all on all sequences in schema ops, staging to service_role;
