-- Controlled synthetic warehouse execution, public run evidence, and nightly scheduling.
-- The existing raw ETL functions become private capabilities: browsers can read results,
-- while only the service role and pg_cron can execute a reload.

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.pipeline_runs (
  run_id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed', 'cooldown')),
  duration_ms integer,
  premium_rows integer,
  loss_rows integer,
  dq_run_id uuid,
  checks_passed integer,
  checks_total integer,
  error_message text
);

create index if not exists pipeline_runs_started_at_idx
  on public.pipeline_runs (started_at desc);

alter table public.pipeline_runs enable row level security;

drop policy if exists pipeline_runs_public_read on public.pipeline_runs;
revoke all on public.pipeline_runs from public, anon, authenticated;
grant select on public.pipeline_runs to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- A reload must be idempotent. Earlier demo migrations did not constrain the
-- current SCD row, so ON CONFLICT DO NOTHING could append another current row
-- for every policy. Remap any already-referenced duplicates before removing them.
with ranked as (
  select
    policy_key,
    first_value(policy_key) over (
      partition by policy_number
      order by effective_date desc nulls last, valid_from desc, policy_key desc
    ) as keeper_key
  from public.dim_policy
  where is_current
)
update public.fact_premium f
set policy_key = r.keeper_key
from ranked r
where f.policy_key = r.policy_key
  and r.policy_key <> r.keeper_key;

with ranked as (
  select
    policy_key,
    first_value(policy_key) over (
      partition by policy_number
      order by effective_date desc nulls last, valid_from desc, policy_key desc
    ) as keeper_key
  from public.dim_policy
  where is_current
)
update public.fact_loss f
set policy_key = r.keeper_key
from ranked r
where f.policy_key = r.policy_key
  and r.policy_key <> r.keeper_key;

with ranked as (
  select
    policy_key,
    row_number() over (
      partition by policy_number
      order by effective_date desc nulls last, valid_from desc, policy_key desc
    ) as policy_rank
  from public.dim_policy
  where is_current
)
delete from public.dim_policy p
using ranked r
where p.policy_key = r.policy_key
  and r.policy_rank > 1;

create unique index if not exists dim_policy_one_current_policy_idx
  on public.dim_policy (policy_number)
  where is_current;

create or replace function public.sp_load_dimensions()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.sp_populate_dim_date(
    least((select min(txn_date) from staging.raw_premium_txn),
          (select min(effective_date) from staging.raw_premium_txn)),
    greatest((select max(txn_date) from staging.raw_premium_txn),
             (select max(expiration_date) from staging.raw_premium_txn)));

  insert into public.dim_lob (lob_code, lob_name)
  select distinct lob_code, lob_name from staging.raw_premium_txn
  on conflict (lob_code) do update set lob_name = excluded.lob_name;

  insert into public.dim_insured (insured_id, insured_name, state, segment)
  select distinct insured_id, insured_name, state, segment from staging.raw_premium_txn
  on conflict (insured_id) do update
    set insured_name = excluded.insured_name, state = excluded.state, segment = excluded.segment;

  insert into public.dim_agent (agent_id, agent_name, agency, region)
  select distinct agent_id, agent_name, agency, region from staging.raw_premium_txn
  on conflict (agent_id) do update
    set agent_name = excluded.agent_name, agency = excluded.agency, region = excluded.region;

  insert into public.dim_transaction_type (txn_code, txn_name, txn_group) values
    ('NB','New Business','premium'), ('RN','Renewal','premium'),
    ('EN','Endorsement','premium'), ('CN','Cancellation','premium'),
    ('PD','Paid Loss','loss'), ('RS','Case Reserve','loss'), ('RC','Recovery','loss')
  on conflict (txn_code) do update
    set txn_name = excluded.txn_name, txn_group = excluded.txn_group;

  insert into public.dim_policy (
    policy_number, lob_key, insured_key, agent_key,
    effective_date, expiration_date, status, valid_from, is_current
  )
  select distinct on (p.policy_number)
         p.policy_number, l.lob_key, i.insured_key, a.agent_key,
         p.effective_date, p.expiration_date, p.status, p.effective_date, true
  from staging.raw_premium_txn p
  join public.dim_lob l     on l.lob_code = p.lob_code
  join public.dim_insured i on i.insured_id = p.insured_id
  join public.dim_agent a   on a.agent_id = p.agent_id
  order by p.policy_number, p.txn_date desc
  on conflict (policy_number) where is_current do update
    set lob_key = excluded.lob_key,
        insured_key = excluded.insured_key,
        agent_key = excluded.agent_key,
        effective_date = excluded.effective_date,
        expiration_date = excluded.expiration_date,
        status = excluded.status,
        valid_from = excluded.valid_from,
        valid_to = null,
        is_current = true;
end
$$;

create or replace function private.run_nico_pipeline(p_trigger text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_dq_run_id uuid;
  v_started_at timestamptz := clock_timestamp();
  v_premium_rows integer;
  v_loss_rows integer;
  v_checks_passed integer;
  v_checks_total integer;
begin
  if p_trigger not in ('manual', 'scheduled') then
    raise exception using errcode = '22023', message = 'Unsupported pipeline trigger';
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('nico-pc-warehouse-pipeline')) then
    insert into public.pipeline_runs (
      run_id, trigger_type, started_at, finished_at, status, duration_ms, error_message
    ) values (
      v_run_id, p_trigger, v_started_at, clock_timestamp(), 'cooldown', 0,
      'Another synthetic warehouse run is already active.'
    );
    return v_run_id;
  end if;

  insert into public.pipeline_runs (run_id, trigger_type, started_at, status)
  values (v_run_id, p_trigger, v_started_at, 'running');

  begin
    perform public.sp_load_dimensions();
    perform public.sp_load_facts();
    v_dq_run_id := public.sp_run_data_quality();

    select count(*)::integer into v_premium_rows from public.fact_premium;
    select count(*)::integer into v_loss_rows from public.fact_loss;
    select count(*)::integer,
           count(*) filter (where status = 'pass')::integer
      into v_checks_total, v_checks_passed
      from public.dq_results
      where run_id = v_dq_run_id;

    if v_checks_total = 6 and v_checks_passed = v_checks_total then
      update public.pipeline_runs
      set finished_at = clock_timestamp(),
          status = 'success',
          duration_ms = greatest(1, round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::integer),
          premium_rows = v_premium_rows,
          loss_rows = v_loss_rows,
          dq_run_id = v_dq_run_id,
          checks_passed = v_checks_passed,
          checks_total = v_checks_total
      where run_id = v_run_id;
    else
      -- Raising inside this nested block rolls back the dimension/fact refresh and
      -- its DQ rows while leaving the outer pipeline_runs evidence row available.
      raise exception using errcode = 'P0001', message = 'Data quality gate failed.';
    end if;
  exception when others then
    update public.pipeline_runs
    set finished_at = clock_timestamp(),
        status = 'failed',
        duration_ms = greatest(1, round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::integer),
        premium_rows = v_premium_rows,
        loss_rows = v_loss_rows,
        dq_run_id = v_dq_run_id,
        checks_passed = v_checks_passed,
        checks_total = v_checks_total,
        error_message = case
          when sqlstate = 'P0001' and sqlerrm = 'Data quality gate failed.'
            then 'Data quality gate failed.'
          else 'Pipeline execution failed (' || sqlstate || ').'
        end
    where run_id = v_run_id;
  end;

  return v_run_id;
end;
$$;

revoke all on function private.run_nico_pipeline(text) from public, anon, authenticated;

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
  -- Serialize the cooldown decision with execution. A blocking transaction lock
  -- lets a concurrent request observe the first request's committed run before
  -- deciding whether another manual refresh is allowed.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nico-pc-warehouse-pipeline')
  );

  select run_id into v_previous_run
  from public.pipeline_runs
  where trigger_type = 'manual'
    and started_at > clock_timestamp() - interval '5 minutes'
  order by started_at desc
  limit 1;

  if v_previous_run is not null then
    return jsonb_build_object('run_id', v_previous_run, 'accepted', false);
  end if;

  v_run_id := private.run_nico_pipeline('manual');
  return jsonb_build_object('run_id', v_run_id, 'accepted', true);
end;
$$;

revoke all on function public.run_demo_pipeline() from public, anon, authenticated;
grant execute on function public.run_demo_pipeline() to service_role;

revoke execute on function public.sp_populate_dim_date(date, date) from public, anon, authenticated;
revoke execute on function public.sp_load_dimensions() from public, anon, authenticated;
revoke execute on function public.sp_load_facts() from public, anon, authenticated;
revoke execute on function public.sp_run_data_quality() from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

create or replace function public.get_pipeline_runs()
returns table (
  run_id uuid,
  trigger_type text,
  started_at timestamptz,
  finished_at timestamptz,
  status text,
  duration_ms integer,
  premium_rows integer,
  loss_rows integer,
  dq_run_id uuid,
  checks_passed integer,
  checks_total integer,
  error_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.run_id, r.trigger_type, r.started_at, r.finished_at, r.status,
         r.duration_ms, r.premium_rows, r.loss_rows, r.dq_run_id,
         r.checks_passed, r.checks_total, r.error_message
  from public.pipeline_runs r
  order by r.started_at desc
  limit 14;
$$;

revoke all on function public.get_pipeline_runs() from public;
grant execute on function public.get_pipeline_runs() to anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'nico-nightly-warehouse-refresh';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'nico-nightly-warehouse-refresh',
    '15 6 * * *',
    $job$select private.run_nico_pipeline('scheduled');$job$
  );
end;
$$;
