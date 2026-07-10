# P&C Insurance Analytics Platform

An end-to-end **property & casualty insurance data-warehouse** work sample — Kimball star schema on Supabase Postgres, PL/pgSQL stored-procedure ETL, automated data-quality controls, BI dashboards, an interactive rating engine, and BA requirements artifacts.

Built by **Dev (Devashish) Neupane**. **Synthetic data only — no PII.**

🔗 **Live:** https://nico-pc-insurance-analytics.vercel.app · 👉 **See [CASE_STUDY.md](./CASE_STUDY.md) for the full write-up.**

## What it demonstrates

| Area | In this app |
|------|-------------|
| Data Engineering | Star schema (facts/dimensions, SCD2, role-playing dates), stored-procedure source→published ETL, 6 automated data-quality checks |
| Business Analysis | Interactive P&C rating engine, INVEST user stories + Given/When/Then acceptance criteria + traceable test cases |
| BI / Reporting | Portfolio loss-ratio dashboards, premium-vs-loss trends, LOB / state / agent drill-across |

## Stack

- **Frontend:** React 19 · Vite 6 · Tailwind v4 · Recharts
- **Warehouse:** Supabase **Postgres** (dimensions, facts, views, PL/pgSQL procedures, RLS)

## Develop

```bash
npm install
npm run dev      # http://localhost:5178
npm run build    # production build -> dist/
```

Supabase URL + publishable (read-only) key are read from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, with safe fallbacks baked in for the demo.
