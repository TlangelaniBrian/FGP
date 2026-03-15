# First Generation Properties (FGP)

Vertical SaaS platform for automating property development feasibility analysis in the Gauteng, South Africa market.

## Overview

FGP helps property developers evaluate sites in minutes rather than weeks by automating zoning lookups, 3D building massing, financial return modelling, comparable market data scraping, and PDF feasibility report generation.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind CSS |
| Maps | MapLibre GL JS |
| 3D Massing | Three.js r160 |
| State | Zustand · TanStack Query |
| Backend | FastAPI (Python 3.12) |
| Task Queue | Celery · Redis |
| Database | Supabase (PostgreSQL 15 + PostGIS 3.4) |
| ORM | Drizzle ORM |
| Auth | Supabase Auth |
| Scrapers | Playwright (6 scrapers) |
| PDF | WeasyPrint · Jinja2 |
| Infra | Vercel · AWS ECS Fargate |
| Monorepo | pnpm workspaces · GitHub Actions |

## Structure

```
FGP/
├── apps/
│   ├── web/        # Next.js 14 frontend
│   └── worker/     # FastAPI + Celery workers
└── packages/
    ├── database/   # Drizzle ORM schema + migrations
    ├── geo/        # Spatial utilities
    └── ui/         # Shared component library
```

## Getting Started

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ · pnpm
- Python 3.12+

### Run locally
```bash
# Start infrastructure
docker compose up -d

# Frontend
cd apps/web && pnpm install && pnpm dev

# Backend
cd apps/worker
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn main:app --reload
```

## Delivery Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Data Foundation — GIS ingestion, Supabase schema, CI/CD | ⬜ |
| 2 | Spatial Intelligence — zoning + constraint mapping | ⬜ |
| 3 | Parametric Engine — Three.js massing | ⬜ |
| 4 | Financial Core + PDF generation | ⬜ |
| 5 | Scraper Network — 6 Playwright scrapers | ⬜ |
| 6 | Project Management dashboard | ⬜ |
