# Design: Monorepo Running Shell

**Date:** 2026-02-26
**Project:** First Generation Properties
**Scope:** Phase 0 — Monorepo scaffold with running dev environment
**Status:** Approved

---

## Goal

Create a fully running local development environment with both apps (Next.js + FastAPI) starting successfully, Docker Compose bringing up PostGIS + Redis, Supabase CLI configured with the full DB schema, and GitHub Actions CI/CD files in place.

This is the foundation Phase 1 data work and all subsequent phases will build on.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo manager | pnpm workspaces only | Spec-aligned, no extra orchestration overhead for 2 apps |
| Local DB | Supabase CLI (`supabase start`) | Full PostGIS + Auth + Studio UI locally |
| Scaffold depth | Running shell | Proves dev environment works before feature code |
| CI/CD | GitHub Actions YAML files only (no remote) | Repo doesn't exist yet |

---

## Directory Structure

```
first-gen-properties/
├── apps/
│   ├── web/                   # Next.js 14 App Router (TypeScript, Tailwind)
│   └── worker/                # FastAPI (Python 3.12, uv)
├── packages/
│   ├── database/              # Drizzle schema + migration types
│   ├── ui/                    # Shared React component library stub
│   ├── geo/                   # Shared geo types stub
│   └── forms/                 # WeasyPrint template stub
├── infra/
│   └── docker-compose.yml     # PostGIS 15-3.4 + Redis 7 + worker service
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 0001_initial.sql   # Full DB schema from spec
├── scripts/
│   ├── seed/                  # Empty — Phase 1
│   └── scrapers/              # Empty — Phase 5
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint + typecheck on PR
│       └── deploy.yml         # Vercel + ECS on main (ECS step commented out)
├── .env.example
├── pnpm-workspace.yaml
├── package.json               # Root workspace config + dev scripts
└── CLAUDE.md
```

---

## apps/web (Next.js)

- Next.js 14, App Router, TypeScript strict mode
- Tailwind CSS with design tokens from spec (bg `#070d1a`, accent `#3b82f6`, etc.)
- Fonts via `next/font/google`: Playfair Display + DM Mono
- App shell at `/` — topbar + nav using real Tailwind classes (no inline styles)
- Supabase client (`@supabase/ssr`) wired but not yet used
- `packages/ui` as workspace dependency

Key env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL`

---

## apps/worker (FastAPI)

- Python 3.12 managed with `uv` (pyproject.toml)
- FastAPI with `/health` → `{"status": "ok", "version": "0.1.0"}`
- Dependencies installed (not yet used): psycopg3, shapely, geopandas, pydantic v2, celery, redis, httpx, weasyprint
- Config loaded from env via pydantic-settings: `DATABASE_URL`, `REDIS_URL`
- Dockerfile: `python:3.12-slim`, install uv, copy source, uvicorn on :8000

---

## Docker Compose (infra/docker-compose.yml)

Three services:
1. `postgis` — `postgis/postgis:15-3.4`, port 5432, persistent volume
2. `redis` — `redis:7-alpine`, port 6379
3. `worker` — builds from `apps/worker/Dockerfile`, depends on postgis + redis, volume mount for hot-reload

---

## Supabase CLI (supabase/)

- `config.toml` configured for local development
- `migrations/0001_initial.sql` — full schema from CLAUDE.md spec:
  - parcels, zoning_designations, zoning_scheme_rules, dolomite_zones
  - land_use_hexagons, amenities, listings, feasibility_reports
  - compliance_documents, projects, scrape_jobs
  - All GIST indexes included

Dev commands:
```bash
docker compose -f infra/docker-compose.yml up -d   # PostGIS + Redis + worker
supabase start                                       # Auth + Studio
pnpm dev                                             # Next.js on :3000
```

---

## GitHub Actions

### ci.yml (on PR to main)
1. Node job: `pnpm install` → `pnpm typecheck` → `pnpm lint`
2. Python job: `uv sync` → `ruff check` → `pyright`

### deploy.yml (on push to main)
1. `pnpm build` → `vercel --prod`
2. Build Docker image → push ECR → update ECS task (ECS step commented out until infra/ Terraform is built)

---

## What's NOT in scope

- Actual feature implementation (all Phase 1 GIS ingestion, /analyze/parcel endpoint)
- Terraform infra configuration
- MapLibre map component
- Any scraper code
- Authentication flows

These belong to their respective phases.
