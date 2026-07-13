\set ON_ERROR_STOP on

begin;

create temporary table benchmark_profile_config (
  query_samples integer not null
) on commit drop;
insert into benchmark_profile_config values (:'query_samples'::integer);

create temporary table benchmark_query_samples (
  query_name text not null,
  duration_ms numeric not null
) on commit drop;

do $$
declare
  v_started timestamptz;
  v_iteration integer;
  v_samples integer;
begin
  select query_samples into v_samples from benchmark_profile_config;
  -- One unmeasured pass warms the relevant pages before sampling.
  perform sum(written_premium), sum(earned_premium), sum(unearned_premium)
  from public.fact_premium;
  perform sum(paid_loss), sum(case_reserve), sum(incurred_loss)
  from public.fact_loss;
  perform count(*) from public.vw_pipeline_runs;

  for v_iteration in 1..v_samples loop
    v_started := clock_timestamp();
    perform sum(written_premium), sum(earned_premium), sum(unearned_premium)
    from public.fact_premium;
    insert into benchmark_query_samples values (
      'premium_portfolio_kpis',
      extract(epoch from (clock_timestamp() - v_started)) * 1000
    );

    v_started := clock_timestamp();
    perform sum(paid_loss), sum(case_reserve), sum(incurred_loss)
    from public.fact_loss;
    insert into benchmark_query_samples values (
      'loss_portfolio_kpis',
      extract(epoch from (clock_timestamp() - v_started)) * 1000
    );

    v_started := clock_timestamp();
    perform count(*) from public.vw_pipeline_runs;
    insert into benchmark_query_samples values (
      'pipeline_evidence',
      extract(epoch from (clock_timestamp() - v_started)) * 1000
    );
  end loop;
end;
$$;

select jsonb_build_object(
  'samples', count(*)::integer,
  'p50Ms', round(percentile_cont(0.50) within group (order by duration_ms)::numeric, 3),
  'p95Ms', round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 3),
  'queries', (
    select jsonb_agg(jsonb_build_object(
      'name', query_name,
      'samples', query_samples,
      'p50Ms', p50_ms,
      'p95Ms', p95_ms
    ) order by query_name)
    from (
      select
        query_name,
        count(*)::integer as query_samples,
        round(percentile_cont(0.50) within group (order by duration_ms)::numeric, 3) as p50_ms,
        round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 3) as p95_ms
      from benchmark_query_samples
      group by query_name
    ) per_query
  )
)::text
from benchmark_query_samples;

rollback;
