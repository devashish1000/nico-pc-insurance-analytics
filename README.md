# P&C Insurance Analytics Platform

An independent, synthetic-data work sample tailored to two National Indemnity Company (NICO) hiring contexts: **Data Engineer R14634** and **IT Business Analyst**. The same P&C platform can be reviewed through either role, connecting warehouse implementation and operational controls to requirements, delivery artifacts, acceptance evidence, and business outcomes.

Built by **Dev (Devashish) Neupane**. This is a portfolio project—not a NICO system, engagement, endorsement, or production implementation. It uses no NICO data, PII, proprietary procedures, stakeholder approvals, or internal access.

- **Live app:** https://nico-pc-insurance-analytics.vercel.app
- **Hiring-manager walkthrough:** [docs/release/HIRING_MANAGER_WALKTHROUGH.md](./docs/release/HIRING_MANAGER_WALKTHROUGH.md)
- **Release evidence manifest:** [artifacts/release/evidence-manifest.json](./artifacts/release/evidence-manifest.json)
- **Pre-migration hosted baseline:** [artifacts/release/hosted-logical-backup-20260713T231304Z-manifest.json](./artifacts/release/hosted-logical-backup-20260713T231304Z-manifest.json)
- **Post-run watermark remediation:** [artifacts/release/hosted-watermark-remediation-20260714.json](./artifacts/release/hosted-watermark-remediation-20260714.json)
- **Detailed architecture write-up:** [CASE_STUDY.md](./CASE_STUDY.md)

## What the work sample demonstrates

| Review lens | Demonstrated evidence |
| --- | --- |
| Data Engineer R14634 | Source/staging/published separation; a Postgres dimensional model; stored-procedure loads; incremental, full, and bounded-backfill modes; watermarks; stage metrics; data-quality controls; controlled failure, quarantine, and recovery evidence |
| IT Business Analyst | A Delivery Hub with 3 synthetic business objectives, 5 user stories, 10 acceptance cases, requirements traceability, representative as-is/to-be workflows, an illustrative RACI, governance items, a candidate backlog, and explicit UAT-readiness boundaries |
| Shared decision support | A transparent rating worksheet, portfolio and line-of-business views, loss-ratio evidence, role-specific navigation, and links from requirements to executable or inspectable evidence |
| Delivery quality | Unit/contract tests, pgTAP database contracts, deterministic Chromium journeys at desktop, laptop, 390px, and 320px, plus CI definitions that generate failure diagnostics and schema-validated benchmark artifacts when workflows run |

## Evidence boundaries

| Classification | What it means here |
| --- | --- |
| Implemented | React/Vite UI, Supabase Postgres schema and views, PL/pgSQL pipeline logic, public evidence boundaries, server-side pipeline controls, automated tests, and CI definitions exist in this repository |
| Synthetic / simulated | Portfolio records, rating scenarios, delivery roles, workflow examples, controlled failures, and UAT-readiness artifacts are portfolio simulations |
| Design only | Azure SQL, Synapse, Azure Data Factory, ADLS, Entra, and Power BI are documented as a target-state transfer map; they are not deployed by this project |
| Not claimed | NICO operating procedures, internal systems, production scale, production readiness, stakeholder validation, UAT approval, or benchmark performance without a retained run artifact |

The live proof strip is a point-in-time verification surface. Screenshot values can become stale and are not substitutes for the current live checks. Benchmark row counts in configuration files describe deterministic workload sizes; timing and throughput are valid only when present in a schema-validated GitHub Actions artifact.

## Hosted release state

A 4,184-row synthetic logical baseline was captured at `2026-07-13T23:13:04.347568Z` before the warehouse-v2 release. Hosted migration history then recorded `warehouse_v2_foundation`, `warehouse_v2_loaders`, `warehouse_v2_orchestration_and_views`, `release_fk_indexes`, and the post-run `monotonic_composite_watermarks` guard; all 11 expected foreign-key supporting indexes are present. The guard was added after release auditing caught and repaired a no-source run that could move a future-seeded synthetic cursor backward without changing published facts. See the [machine-readable evidence manifest](./artifacts/release/evidence-manifest.json) for hosted versions and source references.

This proves the recorded deployment sequence and index presence only. It is not a production-scale, latency, throughput, production-readiness, stakeholder-approval, or UAT claim.

## Stack

- **Frontend:** React 19, Vite 6, Recharts, Tailwind CSS v4, Vercel Functions
- **Implemented warehouse:** Supabase Postgres, PL/pgSQL, dimensional facts/dimensions, published views, RLS
- **Quality:** Vitest, pgTAP, Playwright, GitHub Actions
- **Design-only transfer map:** Azure SQL, Synapse, Azure Data Factory, ADLS, Entra, Power BI

## Develop and verify

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

`npm run test:e2e` uses the Chromium projects configured in `playwright.config.ts`. Browser tests use deterministic route fixtures for repeatable UI behavior; database migrations, pgTAP contracts, and disposable benchmark workloads run separately in CI.

Browser reads require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The controlled pipeline endpoint additionally requires server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the service-role key must never use the `VITE_` prefix.

Historical implementation references remain in `design/approved/`. The folder name records an internal design checkpoint only and does not mean NICO reviewed or approved the work.
