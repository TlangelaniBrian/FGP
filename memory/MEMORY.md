# First Generation Properties — Project Memory
**Last updated:** 2026-06-03

## Current status
Phase 1 complete and merged to `main` (commit `f63a050`).

## Completed phases

### Phase 0 — Scaffold (2026-02-26)
- [x] Monorepo root (`pnpm-workspace.yaml`, `package.json`)
- [x] Next.js 16 web app with design tokens and dark app shell
- [x] FastAPI worker with `/health`
- [x] Docker Compose (PostGIS + Redis + worker)
- [x] Supabase CLI + initial DB migration (0001_initial.sql — all spatial/core tables)
- [x] Package stubs: `@fgp/database`, `@fgp/ui`, `@fgp/geo`

### Phase 1 — Projects tracker + Evaluate Land (2026-06-03)
- [x] DB migration `0002_projects_extended.sql` — project sub-tables, zoning_scheme_rules, milestones, RLS
- [x] Drizzle schema + client in `packages/database`
- [x] FastAPI calculation engine: transfer duty (SARS 2026), BSC, yield — 13 tests
- [x] `POST /analyze/feasibility` — in-house rate limiting (10/min), Pydantic v2 validation
- [x] Next.js API routes — feasibility proxy+save, projects CRUD, check-ins
- [x] Sidebar layout, Projects list page, Project detail (6 sections)
- [x] Weekly check-in modal (saves, reflects in This Week)
- [x] Evaluate Land form + result page + "Keep" save flow
- [x] Seed scripts — `pnpm seed:soshanguve`, `pnpm seed:zoning`
- [x] Smoke tested end-to-end, merged to main

## Next session — start here
**Phase 2: Spatial Intelligence**

Deliverables (from CLAUDE.md §13):
- [ ] Amenity scoring algorithm (weighted distance to schools/malls/transport)
- [ ] Rental yield heatmap (aggregate listing data + GCRO hexagons)
- [ ] Rezoning probability scoring
- [ ] MapLibre map component with parcel/zoning/dolomite/amenity layers
- [ ] Scout screen with live map + lead cards

Pre-work before Phase 2:
- [ ] Fix `.env.example` WORKER_URL → `http://127.0.0.1:8000` (not localhost)
- [ ] Add `apps/web/package-lock.json` to `.gitignore`

## How to start local dev
```bash
# 1. Start Supabase
supabase start --exclude edge-runtime

# 2. Seed (first time only)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm seed:soshanguve

# 3. Worker
cd apps/worker && python3 -m uvicorn main:app --port 8000 --env-file .env

# 4. Web
cd apps/web && pnpm dev
```

Open http://localhost:3000 — sidebar shows Soshanguve Build. Navigate to /evaluate to run a feasibility analysis.

## Key decisions (locked)
- No 3rd-party libs for simple middleware — rate limiter is 20-line in-house dict
- `WORKER_URL` must be `http://127.0.0.1:8000` (not localhost) in Node.js 18+
- `supabase start --exclude edge-runtime` on this machine (TLS cert issue with edge runtime)
- Zod v4 + React Hook Form: use `z.number()` + `{ valueAsNumber: true }` on register, not `z.coerce`

## Key files
- Spec: `CLAUDE.md`
- Mockup: `first-gen-properties-mockup.jsx`
- Implementation plan (Phase 1): `docs/superpowers/plans/2026-06-03-phase1-implementation.md`
- Soshanguve data: `docs/Soshanguve Property Project Budget.xlsx`, `docs/Soshanguve_Funding_Tracker_v2.xlsx`
