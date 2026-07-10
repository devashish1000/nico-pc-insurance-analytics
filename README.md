# P&C Insurance Analytics Platform

An end-to-end **property & casualty insurance data-warehouse** work sample — Kimball star schema on Supabase Postgres, controlled PL/pgSQL ETL, scheduled run history, automated quality controls, BI dashboards, an interactive rating engine, and executable BA acceptance tests.

Built by **Dev (Devashish) Neupane**. **Synthetic data only — no PII.**

🔗 **Live:** https://nico-pc-insurance-analytics.vercel.app · 👉 **See [CASE_STUDY.md](./CASE_STUDY.md) for the full write-up.**

## What it demonstrates

| Area | In this app |
|------|-------------|
| Data Engineering | Star schema, role-playing dates, controlled source→published ETL, 6 quality controls, `pg_cron`, and observable run history |
| Business Analysis | Interactive rating engine, INVEST stories, Given/When/Then criteria, and 10 executable traceability tests |
| BI / Reporting | Portfolio loss-ratio dashboards, premium-vs-loss trends, LOB / state / agent drill-across |
| Azure transfer | Honest mapping from demonstrated Postgres patterns to Azure SQL/Synapse, ADF, ADLS, Entra, and Power BI |

## Stack

- **Frontend:** React 19 · Vite 6 · Tailwind v4 · Recharts · Vercel Functions
- **Warehouse:** Supabase **Postgres** (dimensions, facts, views, PL/pgSQL procedures, RLS)

## Develop

```bash
npm install
npm run dev       # local app
npm run lint      # real static-analysis gate
npm run test      # rating, acceptance, and API-boundary tests
npm run test:e2e  # desktop + 390px browser journeys
npm run build     # type check + production build
```

Browser reads use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The controlled pipeline endpoint additionally requires server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the service-role key must never use the `VITE_` prefix.

The accepted visual references are stored in `design/approved/` together with the implementation design contract.
