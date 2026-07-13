\set ON_ERROR_STOP on

begin;

truncate table staging.raw_premium_txn, staging.raw_claim_txn restart identity;
truncate table public.fact_premium, public.fact_loss restart identity;

with benchmark_batch as (
  select md5('nico-benchmark:' || :'mode' || ':' || :'seed')::uuid as batch_id
)
insert into ops.pipeline_batches (
  batch_id, source_name, mode, requested_from, requested_to, cutoff_at,
  status, source_rows, checksum, created_at, finished_at
)
select
  batch_id,
  'all',
  'backfill',
  :'from_date'::date,
  :'to_date'::date,
  (:'to_date'::date + time '23:59:59') at time zone 'UTC',
  'success',
  :'total_rows'::integer,
  md5(:'mode' || ':' || :'seed' || ':' || :'total_rows'),
  timestamptz '2026-07-13 12:00:00+00',
  timestamptz '2026-07-13 12:00:00+00'
from benchmark_batch
on conflict (batch_id) do update
set source_rows = excluded.source_rows,
    checksum = excluded.checksum,
    status = excluded.status,
    finished_at = excluded.finished_at;

with params as (
  select
    :'seed'::integer as seed,
    :'from_date'::date as from_date,
    (:'to_date'::date - :'from_date'::date + 1)::integer as day_span,
    md5('nico-benchmark:' || :'mode' || ':' || :'seed')::uuid as batch_id
), generated as (
  select
    g,
    ((g - 1 + p.seed) % 5 + 1)::integer as lob_no,
    ((g * 17 + p.seed) % p.day_span)::integer as day_offset,
    p.*
  from generate_series(1, :'premium_rows'::integer) g
  cross join params p
)
insert into staging.raw_premium_txn (
  policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
  agent_id, agent_name, agency, region, txn_code, txn_name, txn_date,
  effective_date, expiration_date, status, written_premium, source_txn_id,
  source_updated_at, source_effective_date, batch_id, ingested_at
)
select
  'NICO-' || lpad(g::text, 9, '0'),
  (array['AUTO', 'HOME', 'WC', 'GL', 'COMM'])[lob_no],
  (array['Personal Auto', 'Homeowners', 'Workers Compensation', 'General Liability', 'Commercial Package'])[lob_no],
  'INS-' || lpad((((g - 1) % 50000) + 1)::text, 7, '0'),
  'Synthetic Insured ' || (((g - 1) % 50000) + 1),
  (array['NE', 'IA', 'KS', 'MO', 'CO', 'SD', 'MN', 'TX'])[((g * 7 + seed) % 8) + 1],
  case when g % 4 = 0 then 'Commercial' else 'Personal' end,
  'AGT-' || lpad((((g - 1) % 2000) + 1)::text, 5, '0'),
  'Synthetic Agent ' || (((g - 1) % 2000) + 1),
  'Agency ' || (((g - 1) % 250) + 1),
  (array['Central', 'West', 'South', 'North'])[((g + seed) % 4) + 1],
  (array['NB', 'RN', 'EN'])[((g + seed) % 3) + 1],
  (array['New Business', 'Renewal', 'Endorsement'])[((g + seed) % 3) + 1],
  from_date + day_offset,
  from_date + day_offset,
  from_date + day_offset + 364,
  'Active',
  round((350 + ((g * 7919 + seed) % 965000) / 100.0)::numeric, 2),
  'benchmark-premium-' || lpad(g::text, 10, '0'),
  ((from_date + day_offset) + time '12:00:00') at time zone 'UTC',
  from_date + day_offset,
  batch_id,
  timestamptz '2026-07-13 12:00:00+00' + g * interval '1 microsecond'
from generated;

with params as (
  select
    :'seed'::integer as seed,
    :'from_date'::date as from_date,
    (:'to_date'::date - :'from_date'::date + 1)::integer as day_span,
    :'premium_rows'::integer as premium_rows,
    md5('nico-benchmark:' || :'mode' || ':' || :'seed')::uuid as batch_id
), generated as (
  select
    g,
    (((g - 1) % p.premium_rows) + 1)::integer as policy_no,
    ((((g - 1) % p.premium_rows + p.seed) % 5) + 1)::integer as lob_no,
    (((((g - 1) % p.premium_rows) + 1) * 17 + p.seed) % p.day_span)::integer as day_offset,
    p.*
  from generate_series(1, :'claim_rows'::integer) g
  cross join params p
)
insert into staging.raw_claim_txn (
  claim_number, policy_number, lob_code, txn_code, txn_name, txn_date,
  effective_date, paid_loss, case_reserve, source_txn_id, source_updated_at,
  source_effective_date, batch_id, ingested_at
)
select
  'CLM-' || lpad(g::text, 10, '0'),
  'NICO-' || lpad(policy_no::text, 9, '0'),
  (array['AUTO', 'HOME', 'WC', 'GL', 'COMM'])[lob_no],
  case when g % 3 = 0 then 'RS' else 'PD' end,
  case when g % 3 = 0 then 'Case Reserve' else 'Paid Loss' end,
  from_date + day_offset,
  from_date + day_offset,
  case when g % 3 = 0 then 0 else round((100 + ((g * 3571 + seed) % 2500000) / 100.0)::numeric, 2) end,
  case when g % 3 = 0 then round((250 + ((g * 2371 + seed) % 5000000) / 100.0)::numeric, 2) else 0 end,
  'benchmark-claim-' || lpad(g::text, 10, '0'),
  ((from_date + day_offset) + time '18:00:00') at time zone 'UTC',
  from_date + day_offset,
  batch_id,
  timestamptz '2026-07-13 13:00:00+00' + g * interval '1 microsecond'
from generated;

analyze staging.raw_premium_txn;
analyze staging.raw_claim_txn;

commit;
