-- Warehouse v2 loaders: genuine half-open SCD2, temporal fact resolution,
-- composite-watermark incremental selection, bounded backfill, and six public
-- data-quality controls.

create or replace function private.v2_source_row_in_scope(
  p_source_name text,
  p_source_updated_at timestamptz,
  p_source_txn_id text,
  p_business_date date,
  p_mode text,
  p_from date,
  p_to date,
  p_cutoff timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_source_updated_at <= p_cutoff
    and case
      when p_mode = 'incremental' then
        (p_source_updated_at, p_source_txn_id) > (
          select w.watermark_ts, w.watermark_source_id
          from ops.etl_watermarks w
          where w.source_name = p_source_name
        )
      when p_mode = 'backfill' then
        p_from is not null and p_to is not null
        and p_business_date between p_from and p_to
      else false
    end;
$$;

revoke all on function private.v2_source_row_in_scope(
  text, timestamptz, text, date, text, date, date, timestamptz
) from public, anon, authenticated;

create or replace function private.v2_policy_attribute_hash(
  p_lob_key integer,
  p_insured_key integer,
  p_agent_key integer,
  p_effective_date date,
  p_expiration_date date,
  p_status text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(concat_ws('|', p_lob_key::text, p_insured_key::text,
    p_agent_key::text, p_effective_date::text, p_expiration_date::text,
    p_status));
$$;

revoke all on function private.v2_policy_attribute_hash(
  integer, integer, integer, date, date, text
) from public, anon, authenticated;

create or replace function private.v2_rekey_policy_facts(p_policy_number text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_premium_rows integer := 0;
  v_loss_rows integer := 0;
begin
  -- A late SCD2 boundary can change the correct surrogate key for facts that
  -- were loaded in an earlier run. Re-evaluate every existing fact for the
  -- affected natural key, not only source rows in the current watermark window.
  with latest as (
    select distinct on (source_txn_id)
      source_txn_id, policy_number, txn_date
    from staging.raw_premium_txn
    where policy_number = p_policy_number
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), resolved as (
    select s.source_txn_id, p.policy_key
    from latest s
    join public.dim_policy p
      on p.policy_number = s.policy_number
     and s.txn_date >= p.valid_from
     and (p.valid_to is null or s.txn_date < p.valid_to)
  )
  update public.fact_premium f
  set policy_key = r.policy_key,
      loaded_at = clock_timestamp()
  from resolved r
  where f.source_txn_id = r.source_txn_id
    and f.policy_key is distinct from r.policy_key;

  get diagnostics v_premium_rows = row_count;

  with latest as (
    select distinct on (source_txn_id)
      source_txn_id, policy_number, txn_date
    from staging.raw_claim_txn
    where policy_number = p_policy_number
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), resolved as (
    select s.source_txn_id, p.policy_key
    from latest s
    join public.dim_policy p
      on p.policy_number = s.policy_number
     and s.txn_date >= p.valid_from
     and (p.valid_to is null or s.txn_date < p.valid_to)
  )
  update public.fact_loss f
  set policy_key = r.policy_key,
      loaded_at = clock_timestamp()
  from resolved r
  where f.source_txn_id = r.source_txn_id
    and f.policy_key is distinct from r.policy_key;

  get diagnostics v_loss_rows = row_count;
  return v_premium_rows + v_loss_rows;
end;
$$;

revoke all on function private.v2_rekey_policy_facts(text)
from public, anon, authenticated;

create or replace function private.v2_apply_policy_scd2(
  p_run_id uuid,
  p_policy_number text,
  p_lob_key integer,
  p_insured_key integer,
  p_agent_key integer,
  p_effective_date date,
  p_expiration_date date,
  p_status text,
  p_change_date date,
  p_source_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.dim_policy%rowtype;
  v_next_from date;
  v_hash text := private.v2_policy_attribute_hash(
    p_lob_key, p_insured_key, p_agent_key,
    p_effective_date, p_expiration_date, p_status
  );
begin
  if p_policy_number is null or p_change_date is null then
    raise exception using errcode = '22004',
      message = 'Policy natural key and change date are required';
  end if;

  -- Serialize all versions of this natural key before evaluating boundaries.
  perform 1
  from public.dim_policy
  where policy_number = p_policy_number
  for update;

  -- A newer source record at an existing boundary is a correction to that
  -- version, not another overlapping version.
  select * into v_version
  from public.dim_policy
  where policy_number = p_policy_number
    and valid_from = p_change_date
  order by source_updated_at desc, policy_key desc
  limit 1
  for update;

  if found then
    -- Source corrections are monotonic. A stale late delivery must never
    -- overwrite the newer attributes already recorded at this boundary.
    if p_source_updated_at <= v_version.source_updated_at then
      return 'unchanged';
    end if;

    if v_version.attribute_hash = v_hash then
      update public.dim_policy
      set source_updated_at = p_source_updated_at,
          updated_run_id = p_run_id
      where policy_key = v_version.policy_key;
      return 'unchanged';
    end if;

    update public.dim_policy
    set lob_key = p_lob_key,
        insured_key = p_insured_key,
        agent_key = p_agent_key,
        effective_date = p_effective_date,
        expiration_date = p_expiration_date,
        status = p_status,
        attribute_hash = v_hash,
        source_updated_at = p_source_updated_at,
        updated_run_id = p_run_id
    where policy_key = v_version.policy_key;
    perform private.v2_rekey_policy_facts(p_policy_number);
    return 'updated';
  end if;

  -- Split the version whose half-open validity interval contains the late or
  -- current change. The new version inherits the old upper boundary/current flag.
  select * into v_version
  from public.dim_policy
  where policy_number = p_policy_number
    and valid_from < p_change_date
    and (valid_to is null or p_change_date < valid_to)
  order by valid_from desc, policy_key desc
  limit 1
  for update;

  if found then
    if v_version.attribute_hash = v_hash then
      return 'unchanged';
    end if;

    update public.dim_policy
    set valid_to = p_change_date,
        is_current = false,
        updated_run_id = p_run_id
    where policy_key = v_version.policy_key;

    insert into public.dim_policy (
      policy_number, lob_key, insured_key, agent_key,
      effective_date, expiration_date, status,
      valid_from, valid_to, is_current, attribute_hash,
      source_updated_at, created_run_id, updated_run_id
    ) values (
      p_policy_number, p_lob_key, p_insured_key, p_agent_key,
      p_effective_date, p_expiration_date, p_status,
      p_change_date, v_version.valid_to, v_version.is_current, v_hash,
      p_source_updated_at, p_run_id, p_run_id
    );
    perform private.v2_rekey_policy_facts(p_policy_number);
    return 'inserted';
  end if;

  -- A record earlier than the first known version becomes a closed historical
  -- interval. A brand-new/latest natural key becomes the sole current version.
  select min(valid_from) into v_next_from
  from public.dim_policy
  where policy_number = p_policy_number
    and valid_from > p_change_date;

  insert into public.dim_policy (
    policy_number, lob_key, insured_key, agent_key,
    effective_date, expiration_date, status,
    valid_from, valid_to, is_current, attribute_hash,
    source_updated_at, created_run_id, updated_run_id
  ) values (
    p_policy_number, p_lob_key, p_insured_key, p_agent_key,
    p_effective_date, p_expiration_date, p_status,
    p_change_date, v_next_from, v_next_from is null, v_hash,
    p_source_updated_at, p_run_id, p_run_id
  );
  perform private.v2_rekey_policy_facts(p_policy_number);
  return 'inserted';
end;
$$;

revoke all on function private.v2_apply_policy_scd2(
  uuid, text, integer, integer, integer, date, date, text, date, timestamptz
) from public, anon, authenticated;

create or replace function private.sp_load_dimensions_v2(
  p_run_id uuid,
  p_mode text,
  p_from date,
  p_to date,
  p_cutoff timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_result text;
  v_input integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_min_date date;
  v_max_date date;
begin
  with ranked as (
    select s.*,
      row_number() over (
        partition by s.source_txn_id
        order by s.source_updated_at desc, s.landing_id desc
      ) as source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), candidates as (
    select * from ranked where source_rank = 1
  )
  select count(*)::integer,
    min(least(txn_date, effective_date)),
    max(greatest(txn_date, expiration_date))
  into v_input, v_min_date, v_max_date
  from candidates;

  if v_min_date is not null and v_max_date is not null then
    perform public.sp_populate_dim_date(v_min_date, v_max_date);
  end if;

  with ranked as (
    select s.*,
      row_number() over (
        partition by s.source_txn_id
        order by s.source_updated_at desc, s.landing_id desc
      ) as source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), candidates as (
    select * from ranked where source_rank = 1 and lob_code is not null
  ), latest_lob as (
    select distinct on (lob_code) lob_code, lob_name
    from candidates
    order by lob_code, source_updated_at desc, landing_id desc
  )
  insert into public.dim_lob (lob_code, lob_name)
  select lob_code, lob_name from latest_lob
  on conflict (lob_code) do update set lob_name = excluded.lob_name;

  with ranked as (
    select s.*,
      row_number() over (
        partition by s.source_txn_id
        order by s.source_updated_at desc, s.landing_id desc
      ) as source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), candidates as (
    select * from ranked where source_rank = 1 and insured_id is not null
  ), latest_insured as (
    select distinct on (insured_id) insured_id, insured_name, state, segment
    from candidates
    order by insured_id, source_updated_at desc, landing_id desc
  )
  insert into public.dim_insured (insured_id, insured_name, state, segment)
  select insured_id, insured_name, state, segment from latest_insured
  on conflict (insured_id) do update
  set insured_name = excluded.insured_name,
      state = excluded.state,
      segment = excluded.segment;

  with ranked as (
    select s.*,
      row_number() over (
        partition by s.source_txn_id
        order by s.source_updated_at desc, s.landing_id desc
      ) as source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), candidates as (
    select * from ranked where source_rank = 1 and agent_id is not null
  ), latest_agent as (
    select distinct on (agent_id) agent_id, agent_name, agency, region
    from candidates
    order by agent_id, source_updated_at desc, landing_id desc
  )
  insert into public.dim_agent (agent_id, agent_name, agency, region)
  select agent_id, agent_name, agency, region from latest_agent
  on conflict (agent_id) do update
  set agent_name = excluded.agent_name,
      agency = excluded.agency,
      region = excluded.region;

  insert into public.dim_transaction_type (txn_code, txn_name, txn_group) values
    ('NB','New Business','premium'), ('RN','Renewal','premium'),
    ('EN','Endorsement','premium'), ('CN','Cancellation','premium'),
    ('PD','Paid Loss','loss'), ('RS','Case Reserve','loss'), ('RC','Recovery','loss')
  on conflict (txn_code) do update
    set txn_name = excluded.txn_name, txn_group = excluded.txn_group;

  for v_row in
    with ranked as (
      select s.*,
        row_number() over (
          partition by s.source_txn_id
          order by s.source_updated_at desc, s.landing_id desc
        ) as source_rank
      from staging.raw_premium_txn s
      where private.v2_source_row_in_scope(
        'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
        p_mode, p_from, p_to, p_cutoff
      )
    ), candidates as (
      select * from ranked
      where source_rank = 1
        and policy_number is not null
        and lob_code is not null
        and insured_id is not null
        and agent_id is not null
    ), boundary_latest as (
      select distinct on (policy_number, source_effective_date) *
      from candidates
      order by policy_number, source_effective_date,
        source_updated_at desc, landing_id desc
    )
    select c.*, l.lob_key, i.insured_key, a.agent_key
    from boundary_latest c
    join public.dim_lob l on l.lob_code = c.lob_code
    join public.dim_insured i on i.insured_id = c.insured_id
    join public.dim_agent a on a.agent_id = c.agent_id
    order by c.policy_number, c.source_effective_date,
      c.source_updated_at, c.landing_id
  loop
    v_result := private.v2_apply_policy_scd2(
      p_run_id, v_row.policy_number, v_row.lob_key,
      v_row.insured_key, v_row.agent_key,
      v_row.effective_date, v_row.expiration_date, v_row.status,
      v_row.source_effective_date, v_row.source_updated_at
    );
    if v_result = 'inserted' then v_inserted := v_inserted + 1;
    elsif v_result = 'updated' then v_updated := v_updated + 1;
    else v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'input', v_input,
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_unchanged
  );
end;
$$;

revoke all on function private.sp_load_dimensions_v2(
  uuid, text, date, date, timestamptz
) from public, anon, authenticated;

create or replace function private.sp_load_facts_v2(
  p_run_id uuid,
  p_mode text,
  p_from date,
  p_to date,
  p_cutoff timestamptz,
  p_as_of_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_premium_input integer := 0;
  v_premium_inserted integer := 0;
  v_premium_updated integer := 0;
  v_premium_unchanged integer := 0;
  v_loss_input integer := 0;
  v_loss_inserted integer := 0;
  v_loss_updated integer := 0;
  v_loss_unchanged integer := 0;
  v_min_date date;
  v_max_date date;
begin
  with premium_ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), claim_ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_claim_txn s
    where private.v2_source_row_in_scope(
      'claim', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), all_dates as (
    select txn_date, effective_date from premium_ranked where source_rank = 1
    union all
    select txn_date, effective_date from claim_ranked where source_rank = 1
  )
  select min(least(txn_date, effective_date)), max(greatest(txn_date, effective_date))
  into v_min_date, v_max_date
  from all_dates;

  if v_min_date is not null and v_max_date is not null then
    perform public.sp_populate_dim_date(v_min_date, v_max_date);
  end if;

  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), resolved as (
    select s.*, dp.policy_key, l.lob_key, i.insured_key, a.agent_key,
      tt.txn_type_key,
      round(s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0))), 2) earned,
      round(s.written_premium - (s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0)))), 2) unearned
    from ranked s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_insured i on i.insured_id = s.insured_id
    join public.dim_agent a on a.agent_id = s.agent_id
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy dp
      on dp.policy_number = s.policy_number
     and s.txn_date >= dp.valid_from
     and (dp.valid_to is null or s.txn_date < dp.valid_to)
    where s.source_rank = 1
  )
  select count(*)::integer,
    count(*) filter (where f.source_txn_id is null)::integer,
    count(*) filter (
      where f.source_txn_id is not null and (
        r.source_updated_at > f.source_updated_at or
        row(r.policy_key, r.lob_key, r.insured_key, r.agent_key, r.txn_type_key,
          r.written_premium, r.earned, r.unearned) is distinct from
        row(f.policy_key, f.lob_key, f.insured_key, f.agent_key, f.txn_type_key,
          f.written_premium, f.earned_premium, f.unearned_premium)
      )
    )::integer,
    count(*) filter (
      where f.source_txn_id is not null and not (
        r.source_updated_at > f.source_updated_at or
        row(r.policy_key, r.lob_key, r.insured_key, r.agent_key, r.txn_type_key,
          r.written_premium, r.earned, r.unearned) is distinct from
        row(f.policy_key, f.lob_key, f.insured_key, f.agent_key, f.txn_type_key,
          f.written_premium, f.earned_premium, f.unearned_premium)
      )
    )::integer
  into v_premium_input, v_premium_inserted, v_premium_updated, v_premium_unchanged
  from resolved r
  left join public.fact_premium f on f.source_txn_id = r.source_txn_id;

  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_premium_txn s
    where private.v2_source_row_in_scope(
      'premium', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), resolved as (
    select s.*, dp.policy_key, l.lob_key, i.insured_key, a.agent_key,
      tt.txn_type_key,
      round(s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0))), 2) earned,
      round(s.written_premium - (s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0)))), 2) unearned
    from ranked s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_insured i on i.insured_id = s.insured_id
    join public.dim_agent a on a.agent_id = s.agent_id
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy dp
      on dp.policy_number = s.policy_number
     and s.txn_date >= dp.valid_from
     and (dp.valid_to is null or s.txn_date < dp.valid_to)
    where s.source_rank = 1
  )
  insert into public.fact_premium (
    txn_date_key, effective_date_key, policy_key, lob_key, insured_key,
    agent_key, txn_type_key, written_premium, earned_premium,
    unearned_premium, policy_count, source_txn_id, source_updated_at,
    load_batch_id, loaded_at, calculation_as_of_date
  )
  select to_char(txn_date, 'YYYYMMDD')::integer,
    to_char(effective_date, 'YYYYMMDD')::integer,
    policy_key, lob_key, insured_key, agent_key, txn_type_key,
    written_premium, earned, unearned, 1, source_txn_id,
    source_updated_at, batch_id, clock_timestamp(), p_as_of_date
  from resolved
  on conflict (source_txn_id) do update
  set txn_date_key = excluded.txn_date_key,
      effective_date_key = excluded.effective_date_key,
      policy_key = excluded.policy_key,
      lob_key = excluded.lob_key,
      insured_key = excluded.insured_key,
      agent_key = excluded.agent_key,
      txn_type_key = excluded.txn_type_key,
      written_premium = excluded.written_premium,
      earned_premium = excluded.earned_premium,
      unearned_premium = excluded.unearned_premium,
      policy_count = excluded.policy_count,
      source_updated_at = excluded.source_updated_at,
      load_batch_id = excluded.load_batch_id,
      loaded_at = excluded.loaded_at,
      calculation_as_of_date = excluded.calculation_as_of_date
  where excluded.source_updated_at > fact_premium.source_updated_at
     or row(excluded.policy_key, excluded.lob_key, excluded.insured_key,
       excluded.agent_key, excluded.txn_type_key, excluded.written_premium,
       excluded.earned_premium, excluded.unearned_premium) is distinct from
       row(fact_premium.policy_key, fact_premium.lob_key,
       fact_premium.insured_key, fact_premium.agent_key,
       fact_premium.txn_type_key, fact_premium.written_premium,
       fact_premium.earned_premium, fact_premium.unearned_premium);

  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_claim_txn s
    where private.v2_source_row_in_scope(
      'claim', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), resolved as (
    select s.*, dp.policy_key, l.lob_key, tt.txn_type_key
    from ranked s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy dp
      on dp.policy_number = s.policy_number
     and s.txn_date >= dp.valid_from
     and (dp.valid_to is null or s.txn_date < dp.valid_to)
    where s.source_rank = 1
  )
  select count(*)::integer,
    count(*) filter (where f.source_txn_id is null)::integer,
    count(*) filter (
      where f.source_txn_id is not null and (
        r.source_updated_at > f.source_updated_at or
        row(r.policy_key, r.lob_key, r.txn_type_key, r.claim_number,
          coalesce(r.paid_loss,0), coalesce(r.case_reserve,0)) is distinct from
        row(f.policy_key, f.lob_key, f.txn_type_key, f.claim_number,
          f.paid_loss, f.case_reserve)
      )
    )::integer,
    count(*) filter (
      where f.source_txn_id is not null and not (
        r.source_updated_at > f.source_updated_at or
        row(r.policy_key, r.lob_key, r.txn_type_key, r.claim_number,
          coalesce(r.paid_loss,0), coalesce(r.case_reserve,0)) is distinct from
        row(f.policy_key, f.lob_key, f.txn_type_key, f.claim_number,
          f.paid_loss, f.case_reserve)
      )
    )::integer
  into v_loss_input, v_loss_inserted, v_loss_updated, v_loss_unchanged
  from resolved r
  left join public.fact_loss f on f.source_txn_id = r.source_txn_id;

  with ranked as (
    select s.*, row_number() over (
      partition by source_txn_id order by source_updated_at desc, landing_id desc
    ) source_rank
    from staging.raw_claim_txn s
    where private.v2_source_row_in_scope(
      'claim', s.source_updated_at, s.source_txn_id, s.txn_date,
      p_mode, p_from, p_to, p_cutoff
    )
  ), resolved as (
    select s.*, dp.policy_key, l.lob_key, tt.txn_type_key
    from ranked s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy dp
      on dp.policy_number = s.policy_number
     and s.txn_date >= dp.valid_from
     and (dp.valid_to is null or s.txn_date < dp.valid_to)
    where s.source_rank = 1
  )
  insert into public.fact_loss (
    txn_date_key, effective_date_key, policy_key, lob_key, claim_number,
    txn_type_key, paid_loss, case_reserve, incurred_loss, claim_count,
    source_txn_id, source_updated_at, load_batch_id, loaded_at
  )
  select to_char(txn_date, 'YYYYMMDD')::integer,
    to_char(effective_date, 'YYYYMMDD')::integer,
    policy_key, lob_key, claim_number, txn_type_key,
    coalesce(paid_loss,0), coalesce(case_reserve,0),
    coalesce(paid_loss,0) + coalesce(case_reserve,0), 1,
    source_txn_id, source_updated_at, batch_id, clock_timestamp()
  from resolved
  on conflict (source_txn_id) do update
  set txn_date_key = excluded.txn_date_key,
      effective_date_key = excluded.effective_date_key,
      policy_key = excluded.policy_key,
      lob_key = excluded.lob_key,
      claim_number = excluded.claim_number,
      txn_type_key = excluded.txn_type_key,
      paid_loss = excluded.paid_loss,
      case_reserve = excluded.case_reserve,
      incurred_loss = excluded.incurred_loss,
      claim_count = excluded.claim_count,
      source_updated_at = excluded.source_updated_at,
      load_batch_id = excluded.load_batch_id,
      loaded_at = excluded.loaded_at
  where excluded.source_updated_at > fact_loss.source_updated_at
     or row(excluded.policy_key, excluded.lob_key, excluded.txn_type_key,
       excluded.claim_number, excluded.paid_loss, excluded.case_reserve) is distinct from
       row(fact_loss.policy_key, fact_loss.lob_key, fact_loss.txn_type_key,
       fact_loss.claim_number, fact_loss.paid_loss, fact_loss.case_reserve);

  return jsonb_build_object(
    'input', v_premium_input + v_loss_input,
    'inserted', v_premium_inserted + v_loss_inserted,
    'updated', v_premium_updated + v_loss_updated,
    'unchanged', v_premium_unchanged + v_loss_unchanged,
    'premium_input', v_premium_input,
    'loss_input', v_loss_input
  );
end;
$$;

revoke all on function private.sp_load_facts_v2(
  uuid, text, date, date, timestamptz, date
) from public, anon, authenticated;

create or replace function private.sp_refresh_earned_premium_v2(
  p_run_id uuid,
  p_as_of_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  with latest as (
    select distinct on (source_txn_id)
      source_txn_id, effective_date, expiration_date, written_premium
    from staging.raw_premium_txn
    order by source_txn_id, source_updated_at desc, landing_id desc
  )
  update public.fact_premium f
  set earned_premium = round(s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0))), 2),
      unearned_premium = round(s.written_premium -
        (s.written_premium * least(1.0, greatest(0.0,
        (p_as_of_date - s.effective_date)::numeric /
        nullif((s.expiration_date - s.effective_date), 0)))), 2),
      calculation_as_of_date = p_as_of_date,
      loaded_at = clock_timestamp()
  from latest s
  where f.source_txn_id = s.source_txn_id
    and f.calculation_as_of_date is distinct from p_as_of_date;

  get diagnostics v_rows = row_count;
  return jsonb_build_object('recalculated', v_rows, 'as_of_date', p_as_of_date);
end;
$$;

revoke all on function private.sp_refresh_earned_premium_v2(uuid, date)
from public, anon, authenticated;

create or replace function private.sp_run_data_quality_v2(p_pipeline_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dq_run_id uuid := gen_random_uuid();
begin
  -- 1. Accepted, deduplicated premium source IDs reconcile to premium facts.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with latest as (
    select distinct on (source_txn_id) *
    from staging.raw_premium_txn
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), accepted as (
    select s.source_txn_id
    from latest s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_insured i on i.insured_id = s.insured_id
    join public.dim_agent a on a.agent_id = s.agent_id
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy p
      on p.policy_number = s.policy_number
     and s.txn_date >= p.valid_from
     and (p.valid_to is null or s.txn_date < p.valid_to)
  )
  select v_dq_run_id, p_pipeline_run_id,
    'Premium source IDs reconcile to published facts',
    'reconciliation', 'critical',
    case when (select count(*) from accepted) =
                   (select count(*) from public.fact_premium)
         then 'pass' else 'fail' end,
    (select count(*)::text from accepted),
    (select count(*)::text from public.fact_premium);

  -- 2. Accepted, deduplicated claim source IDs reconcile to loss facts.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with latest as (
    select distinct on (source_txn_id) *
    from staging.raw_claim_txn
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), accepted as (
    select s.source_txn_id
    from latest s
    join public.dim_lob l on l.lob_code = s.lob_code
    join public.dim_transaction_type tt on tt.txn_code = s.txn_code
    join public.dim_policy p
      on p.policy_number = s.policy_number
     and s.txn_date >= p.valid_from
     and (p.valid_to is null or s.txn_date < p.valid_to)
  )
  select v_dq_run_id, p_pipeline_run_id,
    'Claim source IDs reconcile to published facts',
    'reconciliation', 'critical',
    case when (select count(*) from accepted) =
                   (select count(*) from public.fact_loss)
         then 'pass' else 'fail' end,
    (select count(*)::text from accepted),
    (select count(*)::text from public.fact_loss);

  -- 3. Every fact points to the policy version valid on its transaction date.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with premium_latest as (
    select distinct on (source_txn_id) source_txn_id, policy_number, txn_date
    from staging.raw_premium_txn
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), claim_latest as (
    select distinct on (source_txn_id) source_txn_id, policy_number, txn_date
    from staging.raw_claim_txn
    order by source_txn_id, source_updated_at desc, landing_id desc
  ), bad as (
    select f.source_txn_id
    from public.fact_premium f
    join premium_latest s using (source_txn_id)
    where not exists (
      select 1 from public.dim_policy p
      where p.policy_key = f.policy_key
        and p.policy_number = s.policy_number
        and s.txn_date >= p.valid_from
        and (p.valid_to is null or s.txn_date < p.valid_to)
    )
    union all
    select f.source_txn_id
    from public.fact_loss f
    join claim_latest s using (source_txn_id)
    where not exists (
      select 1 from public.dim_policy p
      where p.policy_key = f.policy_key
        and p.policy_number = s.policy_number
        and s.txn_date >= p.valid_from
        and (p.valid_to is null or s.txn_date < p.valid_to)
    )
  )
  select v_dq_run_id, p_pipeline_run_id,
    'Facts resolve to the valid SCD2 policy version',
    'integrity', 'critical',
    case when (select count(*) from bad) = 0 then 'pass' else 'fail' end,
    '0', (select count(*)::text from bad);

  -- 4. Exactly one current version exists for every policy natural key.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with bad as (
    select policy_number
    from public.dim_policy
    group by policy_number
    having count(*) filter (where is_current) <> 1
  )
  select v_dq_run_id, p_pipeline_run_id,
    'One current SCD2 version per policy',
    'integrity', 'critical',
    case when (select count(*) from bad) = 0 then 'pass' else 'fail' end,
    '0', (select count(*)::text from bad);

  -- 5. Half-open policy validity windows never overlap.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with overlap_rows as (
    select a.policy_key
    from public.dim_policy a
    join public.dim_policy b
      on a.policy_number = b.policy_number
     and a.policy_key < b.policy_key
     and daterange(a.valid_from, coalesce(a.valid_to, 'infinity'::date), '[)') &&
         daterange(b.valid_from, coalesce(b.valid_to, 'infinity'::date), '[)')
  )
  select v_dq_run_id, p_pipeline_run_id,
    'SCD2 policy validity windows do not overlap',
    'validity', 'critical',
    case when (select count(*) from overlap_rows) = 0 then 'pass' else 'fail' end,
    '0', (select count(*)::text from overlap_rows);

  -- 6. Published financial measures remain complete and arithmetically valid.
  insert into public.dq_results (
    run_id, pipeline_run_id, check_name, category, severity,
    status, expected_value, actual_value
  )
  with bad as (
    select source_txn_id from public.fact_premium
    where written_premium is null
       or earned_premium is null
       or unearned_premium is null
       or abs((earned_premium + unearned_premium) - written_premium) > 0.01
    union all
    select source_txn_id from public.fact_loss
    where incurred_loss is distinct from coalesce(paid_loss,0) + coalesce(case_reserve,0)
  )
  select v_dq_run_id, p_pipeline_run_id,
    'Premium and loss measures reconcile arithmetically',
    'validity', 'critical',
    case when (select count(*) from bad) = 0 then 'pass' else 'fail' end,
    '0', (select count(*)::text from bad);

  return v_dq_run_id;
end;
$$;

revoke all on function private.sp_run_data_quality_v2(uuid)
from public, anon, authenticated;

-- Preserve the legacy zero-argument DQ function for owner-side tooling while
-- keeping it unavailable to browser roles.
create or replace function public.sp_run_data_quality()
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.sp_run_data_quality_v2(null);
$$;

revoke all on function public.sp_run_data_quality()
from public, anon, authenticated;
grant execute on function public.sp_run_data_quality() to service_role;
