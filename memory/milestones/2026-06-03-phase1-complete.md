# Milestone: Phase 1 Complete
**Date:** 2026-06-03
**Merge commit:** f63a050
**Branch:** feat/phase-1 → main

---

## What was delivered

### Backend — `apps/worker`
- `services/calculations.py` — SARS 2026 transfer duty, municipal BSC (JHB/Tshwane/Ekurhuleni), yield engine
- `routers/feasibility.py` — `POST /analyze/feasibility` with in-house rate limiter (10 req/min per IP using defaultdict)
- 13 pytest tests: transfer duty, BSC, feasibility score, endpoint validation, rate limiting
- `slowapi` explicitly rejected — in-house implementation preferred

### Database — `supabase/migrations/0002_projects_extended.sql`
New tables: `project_budget_items`, `project_contacts`, `project_decisions`, `project_checkins`, `zoning_scheme_rules`, `milestones`
All with RLS policies (`owner_only` via `auth.uid()`). `zoning_scheme_rules` is public reference data (no RLS).

### ORM — `packages/database`
Full Drizzle schema covering all Phase 1 tables. `skipLibCheck: true` added to tsconfig to suppress drizzle-orm's own internal type errors for non-Postgres dialects.

### Seed scripts — `scripts/seed/`
- `seed_zoning_rules.ts` — JHB + Tshwane RES1–RES4 with coverage, FAR, storeys, setbacks
- `seed_soshanguve.ts` — full Soshanguve Build project: 31 budget items, 4 contacts, 5 decisions, 7 milestones

### Frontend — `apps/web`
- Sidebar layout (server component, fetches projects list)
- `/projects` — project list page
- `/projects/[id]` — detail page with 6 sections: ThisWeek, FinanceStrip, MilestonesTimeline, BudgetTable, ContactsTable, DecisionLog
- `/evaluate` — form (React Hook Form + Zod v4, `valueAsNumber` pattern)
- `/evaluate/result` — ephemeral result with "Keep" save flow
- 5 API routes: feasibility proxy, feasibility save, projects list, project detail, check-ins

---

## Technical notes

### Zod v4 + React Hook Form
`z.coerce.number()` in Zod v4 returns `ZodPipeline` — incompatible with RHF's Resolver type.
Fix: use `z.number()` in schema + `register("field", { valueAsNumber: true })` on `<input type="number">`.

### Node.js 18+ localhost resolution
`WORKER_URL=http://localhost:8000` causes a 404 from Next.js because Node 18+ prefers IPv6 (`::1`) while uvicorn binds `127.0.0.1`. Must use `http://127.0.0.1:8000`.

### Python environment
`uv` not available due to TLS cert issues on this machine. Worker tests run with system Python 3.9 + `pip3`. `eval_type_backport` installed to handle `X | Y` union syntax on Python 3.9 (project requires 3.12 in prod, system is 3.9).

### Supabase edge-runtime
Start with `supabase start --exclude edge-runtime`. Edge runtime fails with TLS UnknownIssuer on this machine — not needed (we don't use Edge Functions).

---

## What was NOT done (Phase 1 out of scope)
- No map component (Phase 2)
- No scrapers (Phase 5)
- No PDF generation (Phase 4)
- No Supabase Auth / RLS enforcement (no user login yet — all queries use service role)
- GitHub Actions CI not updated to include Phase 1 tests

---

## Blockers / open items
- `apps/web/package-lock.json` ghost file causes Next.js Turbopack warning — add to .gitignore
- `.env.example` WORKER_URL should be `127.0.0.1` not `localhost`
