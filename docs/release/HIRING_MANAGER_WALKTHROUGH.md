# Hiring-manager walkthrough

This walkthrough presents the P&C Insurance Analytics Platform as one independent portfolio work sample for two National Indemnity Company (NICO) hiring contexts: **Data Engineer R14634** and **IT Business Analyst**. It is designed for a focused 8–10 minute review.

> Scope boundary: all portfolio data, roles, workflows, decisions, exceptions, and UAT artifacts are synthetic or illustrative. No NICO system, employee, proprietary data, operating procedure, internal benchmark, stakeholder review, or approval was used.

## Start with the shared outcome — 1 minute

Open the [live app](https://nico-pc-insurance-analytics.vercel.app/) and note the two exact review paths. Both roles use the same underlying product and evidence; the persona choice changes the sequence, not the facts.

The landing page summarizes the demonstrated flow: source records → staging → dimensional warehouse → quality controls → decision views. The proof strip performs point-in-time checks for published data quality, executable acceptance cases, and bounded pipeline history. Treat its values as live observations, not permanent release claims.

## Data Engineer R14634 path — 3 minutes

Choose **Explore Data Engineer R14634**.

1. **Pipeline Runs:** inspect normal, controlled-failure, and recovery actions; run/stage metrics; watermarks; row outcomes; sanitized failure reasons; and quarantine lineage. The browser does not receive the service-role credential.
2. **Warehouse Architecture:** follow the implemented Supabase Postgres source/staging/published layers, dimensional grain, conformed dimensions, and fact tables.
3. **Data Quality:** review reconciliation, integrity, completeness, and validity evidence published after a load. Do not infer that a screenshot's check count is a permanent state; use the live proof surface or a retained run artifact.
4. **Portfolio Overview / Lines of Business:** connect governed warehouse measures to premium, loss, claims, and loss-ratio decisions.
5. **Azure Stack Mapping:** evaluate the proposed transfer of demonstrated Postgres patterns to Azure SQL, Synapse, Azure Data Factory, ADLS, Entra, and Power BI. This page is explicitly **design only**; no Azure deployment is claimed.

What this path is intended to show: data modeling, SQL/PL/pgSQL pipeline design, repeatable loads, observability, failure handling, data integrity, secure browser/server boundaries, and the ability to explain technical evidence in business terms.

## IT Business Analyst path — 3 minutes

Choose **Explore IT Business Analyst**. The default view is the Delivery Hub.

1. **Traceability:** connect 3 synthetic objectives to 5 user stories, business/data rules, source artifacts, 10 acceptance cases, evidence views, and implementation status.
2. **As-Is / To-Be:** compare a representative P&C delivery-risk scenario with the behavior demonstrated in the portfolio app. It is not a description of NICO operations.
3. **RACI:** inspect an illustrative cross-functional role model. It does not represent NICO reporting lines, staffing, or approval authority.
4. **Governance:** review recorded decisions, assumptions, dependencies, and open questions—including items that require real stakeholder discovery.
5. **Backlog:** review candidate increments and their value, acceptance summary, size, dependencies, and status. They are proposals, not completed features or NICO commitments.
6. **UAT Readiness:** verify the distinction between executable portfolio evidence and organizational acceptance. The artifact records author self-review only; NICO stakeholder validation and production-readiness assessment were not performed.
7. **Requirements & Tests / Rating Engine:** filter stories, inspect Given/When/Then criteria and rules, run scoped acceptance cases, and reproduce synthetic quote calculations through a visible worksheet.

What this path is intended to show: requirements discovery, traceability, process framing, stakeholder-role analysis, governance discipline, backlog shaping, acceptance design, UAT boundaries, and translation between technical evidence and business outcomes.

## Close on delivery discipline — 1–2 minutes

- Application checks run type checking, static analysis, unit/contract tests, and a production build.
- Chromium journeys cover desktop, laptop, 390px mobile, and 320px mobile behavior using deterministic REST/API fixtures.
- Database CI applies migrations from scratch, runs pgTAP contracts, and generates a schema-validated 10,000-row smoke benchmark artifact in an isolated local database.
- Main/scheduled benchmark automation defines a 150,000-row primary workload; the 1,000,000-row extended workload is manual-only.
- The workload sizes above are configuration facts, not observed performance. This repository intentionally publishes no latency, throughput, or pass claim without the corresponding GitHub Actions artifact.

## Hosted release record

A 4,184-row synthetic logical baseline was captured at `2026-07-13T23:13:04.347568Z`, before the warehouse-v2 release migrations. Hosted migration history subsequently recorded:

1. `20260713232107` — `warehouse_v2_foundation`
2. `20260713232116` — `warehouse_v2_loaders`
3. `20260713232126` — `warehouse_v2_orchestration_and_views`
4. `20260713232357` — `release_fk_indexes`

All 11 expected foreign-key supporting indexes are present. This is evidence of the recorded deployment sequence and index presence—not evidence of production scale, benchmark performance, production readiness, NICO stakeholder approval, or UAT acceptance.

## Evidence map

| Question | Best evidence |
| --- | --- |
| Can the candidate connect business intent to tests and implementation? | Delivery Hub → Traceability; Requirements & Tests |
| Can the candidate reason about reliable pipelines? | Pipeline Runs; Warehouse Architecture; Data Quality |
| Can the candidate expose and recover from failure safely? | Controlled failure, quarantine, recovery lineage, and server-only action boundary |
| Can the candidate turn governed data into a decision? | Portfolio Overview; Lines of Business; Rating Engine |
| Are the role and approval boundaries honest? | Delivery Hub disclaimers, Governance, UAT Readiness, and this walkthrough's scope boundary |
| Can the evidence be reproduced? | Repository tests, GitHub Actions workflows, screenshots, and the [release manifest](../../artifacts/release/evidence-manifest.json) |

## Release references

- [Desktop Delivery Hub screenshot](../../artifacts/screenshots/goal2-desktop-delivery-hub.png)
- [Desktop overview screenshot](../../artifacts/screenshots/goal2-desktop-overview.png)
- [390px Delivery Hub screenshot](../../artifacts/screenshots/goal2-mobile-390-delivery-hub.png)
- [390px Delivery Hub content screenshot](../../artifacts/screenshots/goal2-mobile-390-delivery-content.png)
- [320px pipeline screenshot](../../artifacts/screenshots/goal2-mobile-320-pipeline.png)
- [Pre-migration hosted baseline manifest](../../artifacts/release/hosted-logical-backup-20260713T231304Z-manifest.json)
- [Machine-readable evidence manifest](../../artifacts/release/evidence-manifest.json)

The screenshots are immutable point-in-time captures for layout and content review. Values visible inside them are neither production metrics nor benchmark results and may differ from later live verification.
