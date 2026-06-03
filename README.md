# First Generation Properties (FGP)

Vertical SaaS platform for automating property development feasibility analysis in the Gauteng, South Africa market. Takes a raw land listing and produces a go/no-go investment decision with supporting compliance documents.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router · TypeScript · Tailwind CSS v4 |
| Maps | MapLibre GL JS (Phase 2) |
| 3D Massing | Three.js r160 (Phase 3) |
| State | Zustand · React Hook Form + Zod |
| Backend | FastAPI (Python 3.12) |
| Task Queue | Celery · Redis |
| Database | Supabase (PostgreSQL 15 + PostGIS 3.4) |
| ORM | Drizzle ORM |
| Auth | Supabase Auth |
| Scrapers | Playwright (6 scrapers — Phase 5) |
| PDF | WeasyPrint · Jinja2 (Phase 4) |
| Infra | Vercel · AWS ECS Fargate |
| Monorepo | pnpm workspaces · GitHub Actions |

## Structure

```
FGP/
├── apps/
│   ├── web/        # Next.js 16 frontend
│   └── worker/     # FastAPI + Celery workers
├── packages/
│   ├── database/   # Drizzle ORM schema + migrations
│   ├── geo/        # Spatial utilities
│   └── ui/         # Shared component library
├── scripts/
│   └── seed/       # DB seed scripts
└── supabase/
    └── migrations/ # SQL migrations
```

## Running Locally

### Prerequisites
- Docker (for Supabase)
- Node.js 20+ · pnpm
- Python 3.9+ (system) — worker targets 3.12 in prod

### 1. Start Supabase (DB + Auth)
```bash
supabase start --exclude edge-runtime
# Note: edge-runtime excluded due to TLS cert issues on some machines
```

### 2. Seed the database
```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm seed:soshanguve
```

### 3. Start the FastAPI worker
```bash
cd apps/worker
python3 -m uvicorn main:app --port 8000 --env-file .env
```

### 4. Start the web app
```bash
cd apps/web
pnpm dev
```

Open http://localhost:3000 — sidebar should show `Soshanguve Build` project.

### Environment files

**`apps/web/.env.local`** (create from `.env.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
WORKER_URL=http://127.0.0.1:8000        # must be 127.0.0.1, not localhost
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**`apps/worker/.env`**:
```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
TARIFF_YEAR=2026
```

## Delivery Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Monorepo scaffold, Docker, Supabase schema | ✅ Done |
| 1 | Projects tracker + Evaluate Land feasibility form | ✅ Done (2026-06-03) |
| 2 | Spatial Intelligence — amenity scoring, heatmap, MapLibre Scout screen | ⬜ Next |
| 3 | Parametric Engine — Three.js massing, unit fit calculator | ⬜ |
| 4 | Financial Core + PDF compliance package generation | ⬜ |
| 5 | Scraper Network — 6 Playwright scrapers | ⬜ |
| 6 | Project Management dashboard | ⬜ |

## What's Built (Phase 1)

- **DB schema** — `project_budget_items`, `project_contacts`, `project_decisions`, `project_checkins`, `zoning_scheme_rules`, `milestones` + RLS policies
- **Drizzle schema** — full TypeScript types for all tables
- **FastAPI calculation engine** — transfer duty (SARS 2026), bulk service contributions, yield calculation — no 3rd-party rate limiting, 20-line in-house implementation
- **`POST /analyze/feasibility`** — proxied from Next.js, rate-limited at 10 req/min
- **Next.js API routes** — feasibility proxy+save, projects CRUD, weekly check-ins
- **Sidebar layout** — server-fetched projects list, active link highlighting
- **Projects list + detail** — 6 sections: This Week, Finance Strip, Milestones Timeline, Budget Table, Contacts, Decision Log
- **Weekly check-in modal** — saves to DB, actions populate "This Week" on reload
- **Evaluate Land form** — municipality/zone/size/price/unit inputs → result page with cost breakdown + yield
- **"Keep" save flow** — ephemeral result persisted to DB on user action
- **Seed scripts** — `pnpm seed:soshanguve` (Soshanguve Build with full budget/contacts/milestones), `pnpm seed:zoning`
