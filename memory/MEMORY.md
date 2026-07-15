# First Generation Properties — Project Memory
**Last updated:** 2026-07-15

## Current status
- Active full-portal goal remains incomplete on branch `pull-new-designs` in isolated worktree `/private/tmp/fgp-pull-new-designs-validation.CtdZIq`.
- Draft PR: https://github.com/TlangelaniBrian/FGP/pull/1 (`pull-new-designs` → `main`). Current published implementation/security-fix head before this documentation update: `0b9b2f9`.
- GitGuardian still fails on historical synthetic test-password occurrences `27722495` and `34833729`; current files generate credentials at runtime and `pnpm test:security-regression` passes.
- Tasks 1–6 are independently approved: identity/security, verification baseline, trusted feasibility, atomic capital governance, visual foundation, and Scout/Parcel/Cost Oracle.
- Task 7A Settings is independently approved with no Critical/Important findings.
- Task 7B Tariffs is paused at RED with untracked `scripts/tariff-controls-smoke.ts`; no production files changed.

## Resume here
- Read [2026-07-15 milestone](milestones/2026-07-15-settings-tariffs-session.md).
- Read `docs/superpowers/plans/2026-07-15-settings-tariffs-controls.md` and `.superpowers/sdd/progress.md`.
- Resume Task 7B from the existing failing smoke, then complete Task 7C browser/whole-slice review.
- Resolve or classify the two GitGuardian incidents in its dashboard, or explicitly authorize a history rewrite; then address any PR #1 review feedback.
- Do not modify the user checkout `/Users/tbmkhabela/Projects/Software/FGP` and do not push without a new user request.

## Local validation
- Supabase API/DB: `54321`/`54322`; FGP web/worker: `3001`/`8001`.
- Martin owns `3000`/`8000`; never point FGP validation at those ports.
- Load the local FGP web environment, then override `WORKER_URL=http://127.0.0.1:8001` before starting web.
- RTK is unavailable; raw commands are the documented fallback.

## Remaining goal scope
- Field-based trusted Tariff controls and five-role browser acceptance.
- Canonical municipality-derived PDFs/package storage and authenticated/private worker boundary.
- Real scraper/Celery behavior, six GIS ingestion scripts, and shared workspace tenancy/RLS matrix.
- Durable browser E2E/visual regression and exact public-host production deployment verification.

## Key references
- Portal handoff: `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal`.
- Task 7 plan: `docs/superpowers/plans/2026-07-15-settings-tariffs-controls.md`.
- Durable task ledger: `.superpowers/sdd/progress.md`.
