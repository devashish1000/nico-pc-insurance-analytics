-- P&C Insurance Data Warehouse — Kimball star schema (published layer)
create schema if not exists staging;

-- ---------- DIMENSIONS ----------
create table public.dim_date (
  date_key      int primary key,          -- yyyymmdd surrogate key
  full_date     date not null,
  year int, quarter int, month int, month_name text, day int
);

create table public.dim_lob (
  lob_key   serial primary key,
  lob_code  text unique not null,
  lob_name  text not null
);

create table public.dim_insured (
  insured_key  serial primary key,
  insured_id   text unique not null,
  insured_name text, state text, segment text          -- Personal / Commercial
);

create table public.dim_agent (
  agent_key  serial primary key,
  agent_id   text unique not null,
  agent_name text, agency text, region text
);

create table public.dim_transaction_type (
  txn_type_key serial primary key,
  txn_code text unique not null,
  txn_name text, txn_group text                          -- premium / loss
);

-- SCD Type 2 conformed policy dimension
create table public.dim_policy (
  policy_key      serial primary key,
  policy_number   text not null,
  lob_key         int references public.dim_lob(lob_key),
  insured_key     int references public.dim_insured(insured_key),
  agent_key       int references public.dim_agent(agent_key),
  effective_date  date, expiration_date date, status text,
  valid_from      date not null default current_date,
  valid_to        date,
  is_current      boolean not null default true
);

-- ---------- FACTS (grain: one row per transaction) ----------
create table public.fact_premium (
  premium_key       bigserial primary key,
  txn_date_key      int references public.dim_date(date_key),
  effective_date_key int references public.dim_date(date_key),   -- role-playing date dim
  policy_key        int references public.dim_policy(policy_key),
  lob_key           int references public.dim_lob(lob_key),
  insured_key       int references public.dim_insured(insured_key),
  agent_key         int references public.dim_agent(agent_key),
  txn_type_key      int references public.dim_transaction_type(txn_type_key),
  written_premium   numeric(14,2), earned_premium numeric(14,2),
  unearned_premium  numeric(14,2), policy_count int
);

create table public.fact_loss (
  loss_key          bigserial primary key,
  txn_date_key      int references public.dim_date(date_key),
  effective_date_key int references public.dim_date(date_key),
  policy_key        int references public.dim_policy(policy_key),
  lob_key           int references public.dim_lob(lob_key),
  claim_number      text,
  txn_type_key      int references public.dim_transaction_type(txn_type_key),
  paid_loss numeric(14,2), case_reserve numeric(14,2),
  incurred_loss numeric(14,2), claim_count int
);

create index idx_fact_premium_lob on public.fact_premium(lob_key);
create index idx_fact_premium_date on public.fact_premium(txn_date_key);
create index idx_fact_loss_lob on public.fact_loss(lob_key);
create index idx_fact_loss_date on public.fact_loss(txn_date_key);

-- ---------- DATA QUALITY RESULTS ----------
create table public.dq_results (
  dq_key bigserial primary key,
  run_id uuid not null,
  check_name text not null,
  category text, severity text, status text,
  expected_value text, actual_value text,
  checked_at timestamptz not null default now()
);
