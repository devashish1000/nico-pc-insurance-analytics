begin;

set local search_path = extensions, public, pg_catalog;

select plan(7);

insert into public.dim_lob (lob_code, lob_name) values
  ('TAPOLD', 'pgTAP legacy coverage'),
  ('TAPNEW', 'pgTAP revised coverage')
on conflict (lob_code) do update set lob_name = excluded.lob_name;

insert into public.dim_insured (insured_id, insured_name, state, segment) values
  ('TAP-INSURED', 'pgTAP Synthetic Insured', 'NE', 'Commercial')
on conflict (insured_id) do nothing;

insert into public.dim_agent (agent_id, agent_name, agency, region) values
  ('TAP-AGENT', 'pgTAP Synthetic Agent', 'pgTAP Agency', 'Central')
on conflict (agent_id) do nothing;

insert into public.dim_transaction_type (txn_code, txn_name, txn_group) values
  ('NB', 'New Business', 'premium'),
  ('PD', 'Paid Loss', 'loss')
on conflict (txn_code) do nothing;

select public.sp_populate_dim_date(date '2025-01-01', date '2025-12-31');

-- Existing-boundary stale correction: a different attribute set delivered with
-- an older source timestamp must not overwrite the newer stored version.
insert into public.dim_policy (
  policy_number, lob_key, insured_key, agent_key, effective_date,
  expiration_date, status, valid_from, valid_to, is_current,
  attribute_hash, source_updated_at
)
select
  'TAP-STALE-POLICY', l.lob_key, i.insured_key, a.agent_key,
  date '2025-01-01', date '2025-12-31', 'Active', date '2025-01-01',
  null, true,
  private.v2_policy_attribute_hash(
    l.lob_key, i.insured_key, a.agent_key,
    date '2025-01-01', date '2025-12-31', 'Active'
  ),
  timestamptz '2025-02-01 12:00:00+00'
from public.dim_lob l
cross join public.dim_insured i
cross join public.dim_agent a
where l.lob_code = 'TAPOLD'
  and i.insured_id = 'TAP-INSURED'
  and a.agent_id = 'TAP-AGENT';

create temporary table tap_stale_before as
select policy_key, lob_key, insured_key, agent_key, attribute_hash, source_updated_at
from public.dim_policy
where policy_number = 'TAP-STALE-POLICY';

create temporary table tap_stale_result as
select private.v2_apply_policy_scd2(
  '30000000-0000-0000-0000-000000000001'::uuid,
  'TAP-STALE-POLICY',
  (select lob_key from public.dim_lob where lob_code = 'TAPNEW'),
  (select insured_key from public.dim_insured where insured_id = 'TAP-INSURED'),
  (select agent_key from public.dim_agent where agent_id = 'TAP-AGENT'),
  date '2025-01-01', date '2025-12-31', 'Cancelled', date '2025-01-01',
  timestamptz '2025-01-15 12:00:00+00'
) as outcome;

select is((select outcome from tap_stale_result), 'unchanged',
  'older correction at an existing boundary returns unchanged');
select ok(not exists (
  select 1
  from public.dim_policy after
  join tap_stale_before before using (policy_key)
  where after.lob_key is distinct from before.lob_key
     or after.insured_key is distinct from before.insured_key
     or after.agent_key is distinct from before.agent_key
     or after.attribute_hash is distinct from before.attribute_hash
     or after.source_updated_at is distinct from before.source_updated_at
), 'older correction preserves keys, attribute hash, and source timestamp');

-- Late SCD2 split: four facts were loaded before the boundary was known. The
-- helper must re-key every fact for this natural key, even though all source
-- records are older than the current incremental watermark.
insert into ops.etl_watermarks (
  source_name, watermark_ts, watermark_source_id, updated_at
) values
  ('premium', timestamptz '2030-01-01 00:00:00+00', 'tap-watermark', clock_timestamp()),
  ('claim', timestamptz '2030-01-01 00:00:00+00', 'tap-watermark', clock_timestamp())
on conflict (source_name) do update
set watermark_ts = excluded.watermark_ts,
    watermark_source_id = excluded.watermark_source_id,
    updated_at = excluded.updated_at;

insert into public.dim_policy (
  policy_number, lob_key, insured_key, agent_key, effective_date,
  expiration_date, status, valid_from, valid_to, is_current,
  attribute_hash, source_updated_at
)
select
  'TAP-REKEY-POLICY', l.lob_key, i.insured_key, a.agent_key,
  date '2025-01-01', date '2025-12-31', 'Active', date '2025-01-01',
  null, true,
  private.v2_policy_attribute_hash(
    l.lob_key, i.insured_key, a.agent_key,
    date '2025-01-01', date '2025-12-31', 'Active'
  ),
  timestamptz '2025-01-01 01:00:00+00'
from public.dim_lob l
cross join public.dim_insured i
cross join public.dim_agent a
where l.lob_code = 'TAPOLD'
  and i.insured_id = 'TAP-INSURED'
  and a.agent_id = 'TAP-AGENT';

insert into staging.raw_premium_txn (
  policy_number, lob_code, lob_name, insured_id, insured_name, state, segment,
  agent_id, agent_name, agency, region, txn_code, txn_name, txn_date,
  effective_date, expiration_date, status, written_premium, source_txn_id,
  source_updated_at, source_effective_date, batch_id, ingested_at
) values
  ('TAP-REKEY-POLICY', 'TAPOLD', 'pgTAP legacy coverage', 'TAP-INSURED',
   'pgTAP Synthetic Insured', 'NE', 'Commercial', 'TAP-AGENT',
   'pgTAP Synthetic Agent', 'pgTAP Agency', 'Central', 'NB', 'New Business',
   date '2025-03-01', date '2025-01-01', date '2025-12-31', 'Active', 1000,
   'tap-premium-before', timestamptz '2025-03-01 12:00:00+00', date '2025-03-01',
   '00000000-0000-0000-0000-000000000001', clock_timestamp()),
  ('TAP-REKEY-POLICY', 'TAPNEW', 'pgTAP revised coverage', 'TAP-INSURED',
   'pgTAP Synthetic Insured', 'NE', 'Commercial', 'TAP-AGENT',
   'pgTAP Synthetic Agent', 'pgTAP Agency', 'Central', 'NB', 'New Business',
   date '2025-09-01', date '2025-01-01', date '2025-12-31', 'Active', 1500,
   'tap-premium-after', timestamptz '2025-09-01 12:00:00+00', date '2025-09-01',
   '00000000-0000-0000-0000-000000000001', clock_timestamp());

insert into staging.raw_claim_txn (
  claim_number, policy_number, lob_code, txn_code, txn_name, txn_date,
  effective_date, paid_loss, case_reserve, source_txn_id, source_updated_at,
  source_effective_date, batch_id, ingested_at
) values
  ('TAP-CLAIM-BEFORE', 'TAP-REKEY-POLICY', 'TAPOLD', 'PD', 'Paid Loss',
   date '2025-03-01', date '2025-01-01', 100, 0, 'tap-claim-before',
   timestamptz '2025-03-01 13:00:00+00', date '2025-03-01',
   '00000000-0000-0000-0000-000000000001', clock_timestamp()),
  ('TAP-CLAIM-AFTER', 'TAP-REKEY-POLICY', 'TAPNEW', 'PD', 'Paid Loss',
   date '2025-09-01', date '2025-01-01', 200, 0, 'tap-claim-after',
   timestamptz '2025-09-01 13:00:00+00', date '2025-09-01',
   '00000000-0000-0000-0000-000000000001', clock_timestamp());

insert into public.fact_premium (
  txn_date_key, effective_date_key, policy_key, lob_key, insured_key, agent_key,
  txn_type_key, written_premium, earned_premium, unearned_premium, policy_count,
  source_txn_id, source_updated_at, load_batch_id, loaded_at, calculation_as_of_date
)
select
  dates.txn_date_key, 20250101, p.policy_key, p.lob_key, p.insured_key, p.agent_key,
  tt.txn_type_key, dates.amount, dates.amount, 0, 1, dates.source_txn_id,
  dates.source_updated_at, '00000000-0000-0000-0000-000000000001',
  clock_timestamp(), date '2025-12-31'
from (values
  (20250301, 1000::numeric, 'tap-premium-before', timestamptz '2025-03-01 12:00:00+00'),
  (20250901, 1500::numeric, 'tap-premium-after', timestamptz '2025-09-01 12:00:00+00')
) dates(txn_date_key, amount, source_txn_id, source_updated_at)
cross join public.dim_policy p
cross join public.dim_transaction_type tt
where p.policy_number = 'TAP-REKEY-POLICY'
  and p.is_current
  and tt.txn_code = 'NB';

insert into public.fact_loss (
  txn_date_key, effective_date_key, policy_key, lob_key, claim_number,
  txn_type_key, paid_loss, case_reserve, incurred_loss, claim_count,
  source_txn_id, source_updated_at, load_batch_id, loaded_at
)
select
  dates.txn_date_key, 20250101, p.policy_key, p.lob_key, dates.claim_number,
  tt.txn_type_key, dates.amount, 0, dates.amount, 1, dates.source_txn_id,
  dates.source_updated_at, '00000000-0000-0000-0000-000000000001',
  clock_timestamp()
from (values
  (20250301, 100::numeric, 'TAP-CLAIM-BEFORE', 'tap-claim-before', timestamptz '2025-03-01 13:00:00+00'),
  (20250901, 200::numeric, 'TAP-CLAIM-AFTER', 'tap-claim-after', timestamptz '2025-09-01 13:00:00+00')
) dates(txn_date_key, amount, claim_number, source_txn_id, source_updated_at)
cross join public.dim_policy p
cross join public.dim_transaction_type tt
where p.policy_number = 'TAP-REKEY-POLICY'
  and p.is_current
  and tt.txn_code = 'PD';

select ok(not exists (
  select 1 from (
    select source_updated_at, 'premium'::text as source_name
    from staging.raw_premium_txn where policy_number = 'TAP-REKEY-POLICY'
    union all
    select source_updated_at, 'claim'::text
    from staging.raw_claim_txn where policy_number = 'TAP-REKEY-POLICY'
  ) s
  join ops.etl_watermarks w using (source_name)
  where s.source_updated_at >= w.watermark_ts
), 're-key fixture is entirely outside the current watermark window');

create temporary table tap_split_result as
select private.v2_apply_policy_scd2(
  '30000000-0000-0000-0000-000000000002'::uuid,
  'TAP-REKEY-POLICY',
  (select lob_key from public.dim_lob where lob_code = 'TAPNEW'),
  (select insured_key from public.dim_insured where insured_id = 'TAP-INSURED'),
  (select agent_key from public.dim_agent where agent_id = 'TAP-AGENT'),
  date '2025-01-01', date '2025-12-31', 'Active', date '2025-07-01',
  timestamptz '2026-01-01 00:00:00+00'
) as outcome;

select is((select outcome from tap_split_result), 'inserted',
  'late policy change creates a new half-open SCD2 version');
select is((
  select count(*)::integer
  from public.fact_premium f
  join staging.raw_premium_txn s using (source_txn_id)
  join public.dim_policy p on p.policy_key = f.policy_key
  where s.policy_number = 'TAP-REKEY-POLICY'
    and s.txn_date >= p.valid_from
    and (p.valid_to is null or s.txn_date < p.valid_to)
), 2, 'all premium facts resolve to the correct temporal policy version');
select is((
  select count(*)::integer
  from public.fact_loss f
  join staging.raw_claim_txn s using (source_txn_id)
  join public.dim_policy p on p.policy_key = f.policy_key
  where s.policy_number = 'TAP-REKEY-POLICY'
    and s.txn_date >= p.valid_from
    and (p.valid_to is null or s.txn_date < p.valid_to)
), 2, 'all loss facts resolve to the correct temporal policy version');
select is((
  select count(distinct policy_key)::integer
  from (
    select policy_key from public.fact_premium
    where source_txn_id in ('tap-premium-before', 'tap-premium-after')
    union all
    select policy_key from public.fact_loss
    where source_txn_id in ('tap-claim-before', 'tap-claim-after')
  ) facts
), 2, 'facts on opposite sides of the boundary use two surrogate keys');

select * from finish();
rollback;
