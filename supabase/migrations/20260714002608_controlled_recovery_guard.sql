begin;

-- Expose only a bounded boolean that tells the browser whether a quarantine
-- row belongs to the predefined controlled-failure workflow. Raw payloads,
-- source identifiers, and internal diagnostics remain private.
create or replace view private.analytics_quarantine_evidence
with (security_barrier = true) as
select q.quarantine_id, q.run_id, q.source_name, q.reason_code,
  q.severity, q.disposition, q.quarantined_at, q.resolved_at,
  q.recovered_by_run_id,
  (
    q.source_name = 'premium'
    and q.reason_code = 'MISSING_POLICY_NUMBER'
    and q.disposition = 'pending'
    and q.recovered_by_run_id is null
    and q.batch_id = q.run_id
    and r.trigger_type = 'manual'
    and r.mode = 'incremental'
    and r.status = 'failed'
    and r.scenario = 'controlled-failure'
  ) as recoverable
from ops.quarantine_records q
join public.pipeline_runs r on r.run_id = q.run_id
order by q.quarantined_at desc
limit 20;

create or replace view public.vw_quarantine_evidence
with (security_invoker = true, security_barrier = true) as
select * from private.analytics_quarantine_evidence;

grant select on private.analytics_quarantine_evidence
to anon, authenticated, service_role;
grant select on public.vw_quarantine_evidence
to anon, authenticated, service_role;

-- The public RPC is the authoritative database boundary for the Vercel
-- server action. A syntactically valid UUID is not sufficient: recovery is
-- allowed only for the still-pending row created by a failed controlled demo.
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
  v_recovery_allowed boolean := false;
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

  if p_action = 'recover' then
    select exists (
      select 1
      from ops.quarantine_records q
      join public.pipeline_runs r on r.run_id = q.run_id
      where q.run_id = p_recovery_run_id
        and q.batch_id = p_recovery_run_id
        and q.source_name = 'premium'
        and q.reason_code = 'MISSING_POLICY_NUMBER'
        and q.disposition = 'pending'
        and q.recovered_by_run_id is null
        and r.trigger_type = 'manual'
        and r.mode = 'incremental'
        and r.status = 'failed'
        and r.scenario = 'controlled-failure'
    ) into v_recovery_allowed;

    if not v_recovery_allowed then
      return jsonb_build_object(
        'run_id', p_recovery_run_id,
        'accepted', false
      );
    end if;
  end if;

  if p_action = 'simulate-failure' then
    -- An unresolved controlled failure remains the single recovery target even
    -- after the time-based cooldown expires.
    select q.run_id into v_previous_run
    from ops.quarantine_records q
    join public.pipeline_runs r on r.run_id = q.run_id
    where q.source_name = 'premium'
      and q.reason_code = 'MISSING_POLICY_NUMBER'
      and q.disposition = 'pending'
      and q.recovered_by_run_id is null
      and q.batch_id = q.run_id
      and r.trigger_type = 'manual'
      and r.mode = 'incremental'
      and r.status = 'failed'
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
grant execute on function public.run_demo_pipeline_action(text, uuid)
to service_role;

commit;
