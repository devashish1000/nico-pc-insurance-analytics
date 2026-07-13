# P&C Insurance Analytics Platform — Case Study

**Author:** Dev (Devashish) Neupane · **Built for two NICO hiring contexts:** Data Engineer R14634 and IT Business Analyst

A live, end-to-end work sample that mirrors what a P&C insurer's Data Warehouse team actually does—from source data through a dimensional warehouse to executive BI, controlled operations, and executable requirements. **All data is synthetic; no PII.**

- **Live app:** https://nico-pc-insurance-analytics.vercel.app
- **Source:** https://github.com/devashish1000/nico-pc-insurance-analytics
- **Stack:** React + Vite + Recharts (frontend) · Supabase **Postgres** (data warehouse) · PL/pgSQL stored procedures

---

## Why this exists

This independent portfolio project is tailored to two NICO hiring contexts—**Data Engineer R14634** and **IT Business Analyst**. Rather than only describe the skills on a resume, it demonstrates them on realistic synthetic P&C insurance data. The entry experience can be viewed through either role, reordering the same evidence into a guided hiring-manager journey without claiming that the roles share a team or operating model.

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
- **Data integrity:** `sp_run_data_quality()` runs 6 checks after each load — source-vs-published reconciliation, referential integrity, completeness, and validity (e.g. incurred = paid + reserve). The live proof surface reports the latest result; screenshots are point-in-time captures, not permanent pass claims.
- **Controlled operations:** a same-origin Vercel Function invokes one service-role-only RPC. Advisory locking, a manual cooldown, and sanitized responses prevent the public browser from receiving privileged SQL access.
- **Scheduled evidence:** Supabase Cron runs the same internal pipeline nightly at 06:15 UTC and a read-only view publishes the latest 14 durations, row counts, and DQ results.

## Business Analysis highlights (Role 2)

- **Rating engine:** an interactive P&C premium calculator — base rate × territory × risk tier × limits, with deductible credits, endorsements, discounts, and a prior-claims surcharge, plus a transparent rating worksheet.
- **Requirements:** INVEST user stories with **Given/When/Then** acceptance criteria, MoSCoW priority, and traceable test cases mapping to the engine and warehouse behavior.
- **Executable traceability:** the live suite combines 6 deterministic rating cases with 4 read-only hosted warehouse checks, reporting expected-versus-actual evidence and linking rating cases into reproducible inputs. CI browser journeys use deterministic REST/API fixtures rather than claiming a live hosted result.
- **Critical-control evidence:** AT-10 selects critical controls by structured category and severity—not display-name text—and requires every critical validity and reconciliation control to pass.
- **Insight delivery:** the Overview surfaces a rate-adequacy alert when a line of business runs above a 100% loss ratio (in the synthetic book, Personal Auto and Homeowners) — the kind of finding a portfolio analyst escalates.

## Honest scope

- Data is **synthetic**, generated in Postgres. No real policyholder data.
- The warehouse runs on **Supabase Postgres** rather than NICO's Microsoft/Azure stack. The demonstrated dimensional modeling, stored-procedure ETL, source-to-published loads, and data-quality controls inform a design-only transfer map for Azure SQL, Synapse, Azure Data Factory, ADLS, Entra, and Power BI; those services are not deployed by this project.
- The rating engine is a simplified illustrative model, not a filed rating plan.
- The Azure Stack Mapping page names the closest Microsoft equivalents and the implementation ramp. It does not claim access to NICO systems or production Azure delivery.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are required release gates.
- Playwright covers 1440×1000 desktop, 1024×768 laptop, 390×844 mobile, and 320×720 narrow-mobile journeys, including exact role framing, Delivery Hub behavior, requirements, controlled recovery, proof states, focus handling, and page-level overflow.
- A 4,184-row synthetic logical baseline was captured at `2026-07-13T23:13:04.347568Z` before warehouse-v2. Hosted migration history then recorded `warehouse_v2_foundation`, `warehouse_v2_loaders`, `warehouse_v2_orchestration_and_views`, and `release_fk_indexes`; all 11 expected foreign-key supporting indexes are present. This is deployment evidence, not a benchmark-performance, production-readiness, NICO approval, or UAT claim.

## Run locally

```bash
npm install
npm run dev
```

Reads from the hosted Supabase project via a read-only publishable key (RLS-guarded synthetic data).
