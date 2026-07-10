-- Synthetic P&C source data (no PII), then run the source->published ETL.
-- NOTE: random() is evaluated per-row inside a generate_series CTE (not in scalar
-- laterals, which Postgres can cache to a single value).
select setseed(0.42);

with base as (
  select g,
    (1+floor(random()*5))::int  li,
    (1+floor(random()*6))::int  si,
    (1+floor(random()*12))::int ai,
    (1+floor(random()*4))::int  ti,
    (current_date - ((30+floor(random()*700))::int))::date eff,
    random() r
  from generate_series(1,600) g
)
insert into staging.raw_premium_txn
  (policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
   agent_id, agent_name, agency, region, txn_code, txn_name,
   txn_date, effective_date, expiration_date, status, written_premium)
select
  'POL-'||lpad(g::text,5,'0'),
  (array['PAUTO','HOME','CAUTO','GL','WC'])[li],
  (array['Personal Auto','Homeowners','Commercial Auto','General Liability','Workers Comp'])[li],
  'INS-'||lpad(g::text,4,'0'), 'Insured '||g,
  (array['NE','IA','KS','MO','CO','SD'])[si],
  case when li in (3,4,5) then 'Commercial' else 'Personal' end,
  'AG-'||lpad(ai::text,3,'0'), 'Agent '||ai,
  (array['Cornhusker Ins Group','Missouri Valley Agency','Great Plains Brokers','Heartland Risk Partners'])[1+ai%4],
  (array['Midwest','Central','Mountain','Great Plains'])[1+ai%4],
  (array['NB','RN','EN','NB'])[ti],
  (array['New Business','Renewal','Endorsement','New Business'])[ti],
  (eff + (floor(r*5))::int)::date, eff, (eff + interval '1 year')::date, 'Active',
  round(((array[1200,1600,5200,4200,6800])[li] * (0.7 + r*0.9))::numeric, 2)
from base;

with cb as (
  select c, (1+floor(random()*600))::int prn, (1+floor(random()*2))::int ci,
    (30+floor(random()*300))::int lag, random() amt
  from generate_series(1,320) c
),
pol as (
  select row_number() over (order by policy_number) rn, policy_number, lob_code, effective_date
  from staging.raw_premium_txn
)
insert into staging.raw_claim_txn
  (claim_number, policy_number, lob_code, txn_code, txn_name, txn_date, effective_date, paid_loss, case_reserve)
select
  'CLM-'||lpad(cb.c::text,5,'0'), p.policy_number, p.lob_code,
  (array['PD','RS'])[cb.ci], (array['Paid Loss','Case Reserve'])[cb.ci],
  (p.effective_date + cb.lag)::date, p.effective_date,
  case when cb.ci=1 then round((300+cb.amt*9000)::numeric,2) else 0 end,
  case when cb.ci=2 then round((300+cb.amt*6000)::numeric,2) else 0 end
from cb join pol p on p.rn = cb.prn;

select public.sp_load_dimensions();
select public.sp_load_facts();
select public.sp_run_data_quality();
