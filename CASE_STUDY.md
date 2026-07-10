# P&C Insurance Analytics Platform — Case Study

**Author:** Dev (Devashish) Neupane · **Built for:** National Indemnity Company (NICO) Data Warehouse team roles (Data Engineer & Business Analyst)

A live, end-to-end work sample that mirrors what a P&C insurer's Data Warehouse team actually does — from source data through a dimensional warehouse to executive BI and the business requirements behind it. **All data is synthetic; no PII.**

- **Live app:** _(Vercel URL)_
- **Source:** https://github.com/devashish1000/nico-pc-insurance-analytics
- **Stack:** React + Vite + Recharts (frontend) · Supabase **Postgres** (data warehouse) · PL/pgSQL stored procedures

---

## Why this exists

NICO opened two roles on the same Data Warehouse team — a **Data Engineer** and a **Business Analyst**. Rather than only describe the skills on a resume, this project demonstrates them on realistic P&C insurance data: a Kimball star schema loaded by stored procedures, automated data-quality controls, BI dashboards, an interactive rating engine, and the requirements/acceptance-criteria artifacts a BA produces.

## Architecture — source → published

```
staging.raw_premium_txn / raw_claim_txn      (source-system extracts)
        │  sp_load_dimensions()   ← conformed dimensions + SCD2 policy
        │  sp_load_facts()        ← fact_premium + fact_loss
        │  sp_run_data_quality()  ← reconciliation / integrity / completeness / validity
        ▼
public: dim_* + fact_*  →  vw_* published views  →  React BI dashboards
```

**Star schema (grain: one row per premium / loss transaction)**
- **Facts:** `fact_premium` (written / earned / unearned premium), `fact_loss` (paid / reserve / incurred loss)
- **Dimensions:** `dim_date` (role-playing: transaction vs. effective date), `dim_policy` (SCD Type 2), `dim_lob`, `dim_insured`, `dim_agent`, `dim_transaction_type`

## Data Engineering highlights (Role 1)

- **SQL + stored procedures:** all ETL is PL/pgSQL — dimension upserts, fact loads, and a data-quality suite.
- **Dimensional modeling:** star schema with facts/dimensions, surrogate keys, SCD Type 2, and role-playing date dimensions.
- **Source-to-published pipeline:** a clear staging → published separation, reloadable and idempotent.
- **Data integrity:** `sp_run_data_quality()` runs 6 checks after each load — source-vs-published reconciliation, referential integrity, completeness, and validity (e.g. incurred = paid + reserve). Currently **6/6 passing**.

## Business Analysis highlights (Role 2)

- **Rating engine:** an interactive P&C premium calculator — base rate × territory × risk tier × limits, with deductible credits, endorsements, discounts, and a prior-claims surcharge, plus a transparent rating worksheet.
- **Requirements:** INVEST user stories with **Given/When/Then** acceptance criteria, MoSCoW priority, and traceable test cases mapping to the engine and warehouse behavior.
- **Insight delivery:** the Overview surfaces a rate-adequacy alert when a line of business runs above a 100% loss ratio (in the synthetic book, Personal Auto and Homeowners) — the kind of finding a portfolio analyst escalates.

## Honest scope

- Data is **synthetic**, generated in Postgres. No real policyholder data.
- The warehouse runs on **Supabase Postgres** rather than NICO's Microsoft/Azure stack — the *techniques* (dimensional modeling, stored-procedure ETL, source-to-published loads, data-quality controls) transfer directly; the specific tooling (Azure Data Factory, SSIS, SQL Server) would be a fast ramp.
- The rating engine is a simplified illustrative model, not a filed rating plan.

## Run locally

```bash
npm install
npm run dev
```

Reads from the hosted Supabase project via a read-only publishable key (RLS-guarded synthetic data).
