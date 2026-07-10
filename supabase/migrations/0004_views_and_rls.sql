-- Published presentation-layer views + read-only RLS for the anon role (synthetic data).

create or replace view public.vw_kpi_summary as
select
  (select coalesce(sum(written_premium),0) from public.fact_premium)  as written_premium,
  (select coalesce(sum(earned_premium),0) from public.fact_premium)   as earned_premium,
  (select coalesce(sum(unearned_premium),0) from public.fact_premium) as unearned_premium,
  (select coalesce(sum(incurred_loss),0) from public.fact_loss)       as incurred_loss,
  (select coalesce(sum(paid_loss),0) from public.fact_loss)           as paid_loss,
  (select coalesce(sum(case_reserve),0) from public.fact_loss)        as open_reserves,
  (select count(*) from public.dim_policy)                            as policy_count,
  (select count(distinct claim_number) from public.fact_loss)         as claim_count,
  round(100 * (select coalesce(sum(incurred_loss),0) from public.fact_loss)
        / nullif((select sum(written_premium) from public.fact_premium),0), 1) as loss_ratio_pct;

create or replace view public.vw_loss_ratio_by_lob as
with prem as (select lob_key, sum(written_premium) wp, count(*) pc from public.fact_premium group by lob_key),
     loss as (select lob_key, sum(incurred_loss) il from public.fact_loss group by lob_key)
select l.lob_code, l.lob_name, p.pc as policy_count, round(p.wp,2) written_premium,
  round(coalesce(x.il,0),2) incurred_loss,
  round(100*coalesce(x.il,0)/nullif(p.wp,0),1) loss_ratio_pct
from prem p join public.dim_lob l on l.lob_key=p.lob_key
left join loss x on x.lob_key=p.lob_key order by written_premium desc;

create or replace view public.vw_premium_trend_monthly as
select to_char(d.full_date,'YYYY-MM') ym, round(sum(fp.written_premium),2) written_premium,
       round(sum(fp.earned_premium),2) earned_premium
from public.fact_premium fp join public.dim_date d on d.date_key=fp.txn_date_key
group by to_char(d.full_date,'YYYY-MM') order by ym;

create or replace view public.vw_loss_trend_monthly as
select to_char(d.full_date,'YYYY-MM') ym, round(sum(fl.incurred_loss),2) incurred_loss
from public.fact_loss fl join public.dim_date d on d.date_key=fl.txn_date_key
group by to_char(d.full_date,'YYYY-MM') order by ym;

create or replace view public.vw_top_agents as
select a.agent_name, a.agency, a.region, round(sum(fp.written_premium),2) written_premium, count(*) policy_count
from public.fact_premium fp join public.dim_agent a on a.agent_key=fp.agent_key
group by a.agent_name, a.agency, a.region order by written_premium desc limit 12;

create or replace view public.vw_state_premium as
select i.state, round(sum(fp.written_premium),2) written_premium, count(*) policy_count
from public.fact_premium fp join public.dim_insured i on i.insured_key=fp.insured_key
group by i.state order by written_premium desc;

create or replace view public.vw_data_quality_latest as
select check_name, category, severity, status, expected_value, actual_value, checked_at
from public.dq_results
where run_id = (select run_id from public.dq_results order by checked_at desc limit 1)
order by dq_key;

create or replace view public.vw_warehouse_objects as
select 'staging'   layer, 'raw_premium_txn'      object_name, (select count(*) from staging.raw_premium_txn)      row_count
union all select 'staging','raw_claim_txn',        (select count(*) from staging.raw_claim_txn)
union all select 'dimension','dim_date',           (select count(*) from public.dim_date)
union all select 'dimension','dim_lob',            (select count(*) from public.dim_lob)
union all select 'dimension','dim_insured',        (select count(*) from public.dim_insured)
union all select 'dimension','dim_agent',          (select count(*) from public.dim_agent)
union all select 'dimension','dim_policy',         (select count(*) from public.dim_policy)
union all select 'dimension','dim_transaction_type',(select count(*) from public.dim_transaction_type)
union all select 'fact','fact_premium',            (select count(*) from public.fact_premium)
union all select 'fact','fact_loss',               (select count(*) from public.fact_loss);

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists anon_read on public.%I', t);
    execute format('create policy anon_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
