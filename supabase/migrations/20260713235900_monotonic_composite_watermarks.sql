-- Keep the incremental composite cursor monotonic even when the landing tables
-- contain source timestamps beyond a run's cutoff. A successful no-op run must
-- not rewind the cursor or claim lineage for a watermark it did not advance.

create or replace function private.enforce_monotonic_etl_watermark()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_name is distinct from old.source_name then
    raise exception using errcode = '22023',
      message = 'ETL watermark source_name is immutable';
  end if;

  if new.watermark_ts > old.watermark_ts
     or (
       new.watermark_ts = old.watermark_ts
       and new.watermark_source_id collate "C" >
           old.watermark_source_id collate "C"
     ) then
    return new;
  end if;

  new.watermark_ts := old.watermark_ts;
  new.watermark_source_id := old.watermark_source_id;
  new.last_successful_run_id := old.last_successful_run_id;
  new.updated_at := old.updated_at;
  return new;
end;
$$;

revoke all on function private.enforce_monotonic_etl_watermark()
from public, anon, authenticated;

-- Repair any cursor already affected by the pre-trigger behavior. Published
-- facts are the durable boundary: advance to their latest composite when it is
-- ahead, never rewind when the ledger is already further forward, and remove
-- lineage that points at a zero-source run. A repair-driven advance has no
-- pipeline owner, so its lineage is intentionally null.
with latest_published as (
  (select 'premium'::text as source_name, source_updated_at as watermark_ts,
      source_txn_id as watermark_source_id
   from public.fact_premium
   order by source_updated_at desc, source_txn_id collate "C" desc
   limit 1)
  union all
  (select 'claim'::text, source_updated_at, source_txn_id
   from public.fact_loss
   order by source_updated_at desc, source_txn_id collate "C" desc
   limit 1)
), repair_candidates as (
  select w.source_name,
    p.watermark_ts as published_ts,
    p.watermark_source_id as published_source_id,
    (
      p.watermark_ts > w.watermark_ts
      or (
        p.watermark_ts = w.watermark_ts
        and p.watermark_source_id collate "C" >
            w.watermark_source_id collate "C"
      )
    ) as published_is_ahead,
    (
      r.status = 'success'
      and r.mode = 'incremental'
      and coalesce(r.source_rows, -1) = 0
      and coalesce(r.inserted_rows, -1) = 0
      and coalesce(r.updated_rows, -1) = 0
      and coalesce(r.recalculated_rows, -1) = 0
      and coalesce(r.rejected_rows, -1) = 0
    ) as owned_by_zero_source_run
  from ops.etl_watermarks w
  join latest_published p using (source_name)
  left join public.pipeline_runs r on r.run_id = w.last_successful_run_id
)
update ops.etl_watermarks w
set watermark_ts = case when c.published_is_ahead
      then c.published_ts else w.watermark_ts end,
    watermark_source_id = case when c.published_is_ahead
      then c.published_source_id else w.watermark_source_id end,
    last_successful_run_id = null,
    updated_at = clock_timestamp()
from repair_candidates c
where c.source_name = w.source_name
  and (c.published_is_ahead or c.owned_by_zero_source_run);

create trigger enforce_monotonic_etl_watermark
before update on ops.etl_watermarks
for each row
execute function private.enforce_monotonic_etl_watermark();
