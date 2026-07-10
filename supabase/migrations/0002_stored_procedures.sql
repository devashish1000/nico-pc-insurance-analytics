-- Staging (raw source layer) + PL/pgSQL stored procedures: source -> published ETL

create table staging.raw_premium_txn (
  policy_number text, lob_code text, lob_name text,
  insured_id text, insured_name text, state text, segment text,
  agent_id text, agent_name text, agency text, region text,
  txn_code text, txn_name text,
  txn_date date, effective_date date, expiration_date date, status text,
  written_premium numeric(14,2)
);

create table staging.raw_claim_txn (
  claim_number text, policy_number text, lob_code text,
  txn_code text, txn_name text,
  txn_date date, effective_date date,
  paid_loss numeric(14,2), case_reserve numeric(14,2)
);

create or replace function public.sp_populate_dim_date(p_start date, p_end date)
returns void language plpgsql as $$
begin
  insert into public.dim_date (date_key, full_date, year, quarter, month, month_name, day)
  select to_char(d,'YYYYMMDD')::int, d,
         extract(year from d)::int, extract(quarter from d)::int,
         extract(month from d)::int, to_char(d,'Mon'), extract(day from d)::int
  from generate_series(p_start, p_end, interval '1 day') d
  on conflict (date_key) do nothing;
end $$;

create or replace function public.sp_load_dimensions()
returns void language plpgsql as $$
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
  on conflict (txn_code) do nothing;

  insert into public.dim_policy (policy_number, lob_key, insured_key, agent_key,
                                 effective_date, expiration_date, status, valid_from, is_current)
  select distinct on (p.policy_number)
         p.policy_number, l.lob_key, i.insured_key, a.agent_key,
         p.effective_date, p.expiration_date, p.status, p.effective_date, true
  from staging.raw_premium_txn p
  join public.dim_lob l     on l.lob_code = p.lob_code
  join public.dim_insured i on i.insured_id = p.insured_id
  join public.dim_agent a   on a.agent_id = p.agent_id
  order by p.policy_number, p.txn_date
  on conflict do nothing;
end $$;

create or replace function public.sp_load_facts()
returns void language plpgsql as $$
begin
  truncate public.fact_premium restart identity;
  truncate public.fact_loss restart identity;

  insert into public.fact_premium (txn_date_key, effective_date_key, policy_key, lob_key,
        insured_key, agent_key, txn_type_key, written_premium, earned_premium,
        unearned_premium, policy_count)
  select to_char(p.txn_date,'YYYYMMDD')::int, to_char(p.effective_date,'YYYYMMDD')::int,
         dp.policy_key, l.lob_key, i.insured_key, a.agent_key, tt.txn_type_key,
         p.written_premium,
         round(p.written_premium * least(1.0, greatest(0.0,
            (current_date - p.effective_date)::numeric / nullif((p.expiration_date - p.effective_date),0))), 2),
         round(p.written_premium - (p.written_premium * least(1.0, greatest(0.0,
            (current_date - p.effective_date)::numeric / nullif((p.expiration_date - p.effective_date),0)))), 2),
         1
  from staging.raw_premium_txn p
  join public.dim_lob l     on l.lob_code = p.lob_code
  join public.dim_insured i on i.insured_id = p.insured_id
  join public.dim_agent a   on a.agent_id = p.agent_id
  join public.dim_transaction_type tt on tt.txn_code = p.txn_code
  left join public.dim_policy dp on dp.policy_number = p.policy_number and dp.is_current;

  insert into public.fact_loss (txn_date_key, effective_date_key, policy_key, lob_key,
        claim_number, txn_type_key, paid_loss, case_reserve, incurred_loss, claim_count)
  select to_char(c.txn_date,'YYYYMMDD')::int, to_char(c.effective_date,'YYYYMMDD')::int,
         dp.policy_key, l.lob_key, c.claim_number, tt.txn_type_key,
         coalesce(c.paid_loss,0), coalesce(c.case_reserve,0),
         coalesce(c.paid_loss,0) + coalesce(c.case_reserve,0), 1
  from staging.raw_claim_txn c
  join public.dim_lob l on l.lob_code = c.lob_code
  join public.dim_transaction_type tt on tt.txn_code = c.txn_code
  left join public.dim_policy dp on dp.policy_number = c.policy_number and dp.is_current;
end $$;

-- Data-quality / integrity suite (reconciliation, integrity, completeness, validity)
create or replace function public.sp_run_data_quality()
returns uuid language plpgsql as $$
declare v_run uuid := gen_random_uuid();
begin
  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'Premium row reconciliation (source vs published)','reconciliation','critical',
    case when (select count(*) from staging.raw_premium_txn)=(select count(*) from public.fact_premium)
         then 'pass' else 'fail' end,
    (select count(*)::text from staging.raw_premium_txn),(select count(*)::text from public.fact_premium);

  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'Premium facts have valid policy key','integrity','critical',
    case when (select count(*) from public.fact_premium where policy_key is null)=0 then 'pass' else 'fail' end,
    '0',(select count(*)::text from public.fact_premium where policy_key is null);

  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'Written premium is not null','completeness','warning',
    case when (select count(*) from public.fact_premium where written_premium is null)=0 then 'pass' else 'fail' end,
    '0',(select count(*)::text from public.fact_premium where written_premium is null);

  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'Incurred loss = paid + reserve','validity','critical',
    case when (select count(*) from public.fact_loss where incurred_loss <> paid_loss + case_reserve)=0
         then 'pass' else 'fail' end,
    '0',(select count(*)::text from public.fact_loss where incurred_loss <> paid_loss + case_reserve);

  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'No unexpected negative premium','validity','warning',
    case when (select count(*) from public.fact_premium fp
               join public.dim_transaction_type tt on tt.txn_type_key=fp.txn_type_key
               where fp.written_premium < 0 and tt.txn_code <> 'CN')=0 then 'pass' else 'fail' end,
    '0',(select count(*)::text from public.fact_premium fp
         join public.dim_transaction_type tt on tt.txn_type_key=fp.txn_type_key
         where fp.written_premium < 0 and tt.txn_code <> 'CN');

  insert into public.dq_results(run_id,check_name,category,severity,status,expected_value,actual_value)
  select v_run,'All lines of business have premium activity','completeness','info',
    case when (select count(*) from public.dim_lob l
               where not exists (select 1 from public.fact_premium f where f.lob_key=l.lob_key))=0
         then 'pass' else 'fail' end,
    '0',(select count(*)::text from public.dim_lob l
         where not exists (select 1 from public.fact_premium f where f.lob_key=l.lob_key));

  return v_run;
end $$;
