# Monorepo Running Shell — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a fully running local development environment: Next.js on :3000, FastAPI on :8000, PostGIS + Redis via Docker Compose, Supabase CLI with full DB schema, and GitHub Actions CI/CD files.

**Architecture:** pnpm workspaces monorepo with `apps/web` (Next.js 14) and `apps/worker` (FastAPI). The Python worker and PostGIS/Redis run in Docker. Next.js runs directly on the host. Supabase CLI manages auth + migrations separately.

**Tech Stack:** Next.js 14 (App Router, TypeScript, Tailwind), FastAPI (Python 3.12, uv), Docker Compose, Supabase CLI, pnpm workspaces, GitHub Actions.

**Working directory:** `/Users/tbmkhabela/Projects/FGP` (current project root — already contains CLAUDE.md and first-gen-properties-mockup.jsx)

**Tool availability (pre-checked):**
- Node 24, pnpm 10, npx create-next-app 16 ✓
- Python 3.14, uv 0.10 ✓
- Docker 29 ✓
- Supabase CLI: **NOT installed** — install in Task 6
- ruff, pyright: **NOT installed** — install via uv in Task 4

---

## Task 1: Initialize monorepo root

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 2: Create root `package.json`**

```json
{
  "name": "first-gen-properties",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "typecheck": "pnpm --filter web run typecheck",
    "lint": "pnpm --filter web lint"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=10"
  }
}
```

**Step 3: Create `.gitignore`**

```gitignore
# Node
node_modules/
.next/
dist/
.turbo/

# Python
__pycache__/
*.pyc
.venv/
.ruff_cache/
.pytest_cache/

# Env
.env
.env.local
.env.*.local

# Docker volumes
.docker/

# Supabase
supabase/.branches
supabase/.temp

# OS
.DS_Store
*.swp
```

**Step 4: Create `.env.example`**

```env
# Supabase (from: supabase status after `supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (direct connection — worker only)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# AWS (leave blank until infra/ is built)
AWS_REGION=af-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=first-gen-properties-docs

# Worker URL (Next.js → FastAPI)
NEXT_PUBLIC_WORKER_URL=http://localhost:8000

# MapLibre
NEXT_PUBLIC_MAPTILER_KEY=

# Scraper (optional)
SCRAPER_PROXY_URL=
SCRAPER_HEADLESS=true

# Tariff year
TARIFF_YEAR=2026
```

**Step 5: Install pnpm workspaces and verify**

```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm install
```

Expected: `Lockfile was successfully patched` or similar. No errors.

**Step 6: Commit**

```bash
git init
git add pnpm-workspace.yaml package.json .gitignore .env.example
git commit -m "chore: initialize monorepo root with pnpm workspaces"
```

---

## Task 2: Scaffold package stubs

These are empty workspace packages that `apps/web` will reference. They'll be filled in during Phase 1–4.

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/index.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/index.ts`
- Create: `packages/geo/package.json`
- Create: `packages/geo/index.ts`

**Step 1: Create `packages/database/package.json`**

```json
{
  "name": "@fgp/database",
  "version": "0.0.1",
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create `packages/database/index.ts`**

```typescript
// Database package — populated during Phase 1
// Will export Drizzle schema, migration utilities, and shared DB types
export {};
```

**Step 3: Repeat for `packages/ui`**

`packages/ui/package.json`:
```json
{
  "name": "@fgp/ui",
  "version": "0.0.1",
  "main": "./index.ts",
  "types": "./index.ts",
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

`packages/ui/index.ts`:
```typescript
// UI package — shared React component library
// Will export MapComponent, Massing3D, and shared design-system components
export {};
```

**Step 4: Repeat for `packages/geo`**

`packages/geo/package.json`:
```json
{
  "name": "@fgp/geo",
  "version": "0.0.1",
  "main": "./index.ts",
  "types": "./index.ts",
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

`packages/geo/index.ts`:
```typescript
// Geo package — shared spatial types between web and worker
// Will export ParcelAnalysis, ZoneRules, DerivedParams, etc.
export {};
```

**Step 5: Commit**

```bash
git add packages/
git commit -m "chore: add empty package stubs (database, ui, geo)"
```

---

## Task 3: Scaffold apps/web (Next.js 14)

**Files:**
- Create: `apps/web/` (full Next.js app via create-next-app)
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/lib/supabase.ts`

**Step 1: Create the Next.js app**

```bash
cd /Users/tbmkhabela/Projects/FGP
npx create-next-app@latest apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

When prompted for any additional options, accept defaults.

**Step 2: Verify it runs**

```bash
cd apps/web && pnpm dev
```

Expected: `✓ Ready on http://localhost:3000` in under 10 seconds. Open http://localhost:3000 — you should see the default Next.js page. Ctrl+C to stop.

**Step 3: Add workspace dependencies to `apps/web/package.json`**

Add to `dependencies` in `apps/web/package.json`:
```json
{
  "@fgp/database": "workspace:*",
  "@fgp/ui": "workspace:*",
  "@fgp/geo": "workspace:*",
  "@supabase/ssr": "^0.5.0",
  "@supabase/supabase-js": "^2.45.0"
}
```

Then:
```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm install
```

**Step 4: Add typecheck script to `apps/web/package.json`**

Add to `scripts` in `apps/web/package.json`:
```json
{
  "typecheck": "tsc --noEmit"
}
```

**Step 5: Configure Tailwind with design tokens**

Replace `apps/web/tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#070d1a",
          surface: "#0f172a",
          elevated: "#0d1929",
        },
        border: {
          DEFAULT: "#1e293b",
          subtle: "#0d1929",
        },
        text: {
          primary: "#f1f5f9",
          muted: "#64748b",
          dim: "#475569",
        },
        accent: {
          blue: "#3b82f6",
          green: "#22c55e",
          amber: "#f59e0b",
          red: "#ef4444",
          purple: "#a855f7",
        },
      },
      fontFamily: {
        heading: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "12px",
        panel: "12px",
        pill: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 6: Replace `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-playfair: "Playfair Display";
  --font-dm-mono: "DM Mono";
}

* {
  box-sizing: border-box;
}

body {
  background: #070d1a;
  color: #f1f5f9;
}
```

**Step 7: Replace `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Playfair_Display, DM_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-playfair",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "First Generation Properties",
  description: "Property development feasibility platform for Gauteng",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmMono.variable}`}>
      <body className="bg-bg-base text-text-primary min-h-screen font-mono">
        {/* Topbar */}
        <header className="bg-[#0a1120] border-b border-border sticky top-0 z-50 h-[58px] px-8 flex items-center gap-10">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-[#1d4ed8] flex items-center justify-center text-sm">
              🏗
            </div>
            <div>
              <div className="font-heading text-sm text-text-primary font-bold leading-none">
                First Generation
              </div>
              <div className="font-mono text-[9px] text-text-muted tracking-[1.5px] uppercase">
                Properties
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex gap-1 flex-1">
            {["Dashboard", "Scout", "Projects", "Settings"].map((item) => (
              <a
                key={item}
                href={`/${item.toLowerCase()}`}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-text-muted hover:text-text-primary hover:bg-border transition-colors"
              >
                {item.toUpperCase()}
              </a>
            ))}
          </nav>

          {/* User */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-purple-600 flex items-center justify-center text-xs font-bold">
              TM
            </div>
            <span className="font-mono text-xs text-text-muted">
              T. Mkhabela
            </span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-58px)]">{children}</main>
      </body>
    </html>
  );
}
```

**Step 8: Replace `apps/web/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">
          System Status
        </p>
        <h1 className="font-heading text-3xl font-bold text-text-primary">
          First Generation Properties
        </h1>
        <p className="text-text-muted font-mono text-sm mt-1">
          Property development feasibility platform · Gauteng, South Africa
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Web App", status: "running", port: ":3000" },
          { label: "Worker API", status: "check manually", port: ":8000" },
          { label: "PostGIS", status: "check manually", port: ":5432" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-bg-surface border border-border rounded-card p-5"
          >
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-2">
              {s.label}
            </div>
            <div className="text-accent-green font-mono text-sm font-semibold">
              {s.status}
            </div>
            <div className="text-text-dim font-mono text-xs mt-1">
              {s.port}
            </div>
          </div>
        ))}
      </div>

      <p className="text-text-muted font-mono text-xs">
        Phase 0 scaffold · No features implemented yet
      </p>
    </div>
  );
}
```

**Step 9: Create Supabase client util `apps/web/lib/supabase.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 10: Verify it still runs**

```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm dev
```

Expected: `✓ Ready on http://localhost:3000`. Open it — you should see the dark status page with "First Generation Properties" heading, Playfair Display font on the heading, DM Mono on the body. No errors in the console.

**Step 11: Verify typecheck passes**

```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm typecheck
```

Expected: No errors.

**Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js web app with design tokens and app shell"
```

---

## Task 4: Scaffold apps/worker (FastAPI)

**Files:**
- Create: `apps/worker/pyproject.toml`
- Create: `apps/worker/main.py`
- Create: `apps/worker/config.py`
- Create: `apps/worker/Dockerfile`
- Create: `apps/worker/.python-version`

**Step 1: Create `apps/worker/.python-version`**

```
3.12
```

Note: Even though Python 3.14 is installed, we pin 3.12 in the worker for compatibility with geospatial dependencies (geopandas/shapely ecosystem lags slightly). uv will download 3.12 automatically.

**Step 2: Create `apps/worker/pyproject.toml`**

```toml
[project]
name = "fgp-worker"
version = "0.1.0"
description = "First Generation Properties — geo processing and scraper worker"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "psycopg[binary]>=3.2.0",
    "shapely>=2.0.0",
    "geopandas>=1.0.0",
    "celery[redis]>=5.4.0",
    "redis>=5.2.0",
    "httpx>=0.28.0",
    "weasyprint>=62.0",
    "playwright>=1.49.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
    "ruff>=0.9.0",
    "pyright>=1.1.390",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "standard"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 3: Create `apps/worker/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    redis_url: str = "redis://localhost:6379"
    tariff_year: int = 2026
    scraper_headless: bool = True


settings = Settings()
```

**Step 4: Create `apps/worker/main.py`**

```python
from fastapi import FastAPI

from config import settings

app = FastAPI(
    title="FGP Worker",
    version="0.1.0",
    description="First Generation Properties — geo processing worker",
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "tariff_year": settings.tariff_year,
    }
```

**Step 5: Install dependencies with uv**

```bash
cd /Users/tbmkhabela/Projects/FGP/apps/worker
uv sync
```

Expected: uv downloads Python 3.12 if needed, creates `.venv/`, installs all dependencies. May take 2-3 minutes on first run (geopandas is large).

**Step 6: Run the worker to verify**

```bash
cd /Users/tbmkhabela/Projects/FGP/apps/worker
uv run uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Will watch for changes in these directories: ['.']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

In a separate terminal:
```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","version":"0.1.0","tariff_year":2026}`

Ctrl+C to stop the server.

**Step 7: Create `apps/worker/Dockerfile`**

```dockerfile
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (layer cache)
COPY pyproject.toml .
RUN uv sync --no-dev --frozen

# Copy source
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 8: Install dev tools for CI**

```bash
cd /Users/tbmkhabela/Projects/FGP/apps/worker
uv sync --extra dev
uv run ruff check .
```

Expected: No linting errors (empty file, passes trivially).

**Step 9: Commit**

```bash
cd /Users/tbmkhabela/Projects/FGP
git add apps/worker/
git commit -m "feat: scaffold FastAPI worker with /health endpoint"
```

---

## Task 5: Docker Compose (PostGIS + Redis + worker)

**Files:**
- Create: `infra/docker-compose.yml`

**Step 1: Create `infra/docker-compose.yml`**

```yaml
version: "3.9"

services:
  postgis:
    image: postgis/postgis:15-3.4
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgis_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  worker:
    build:
      context: ../apps/worker
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgis:5432/postgres
      REDIS_URL: redis://redis:6379
    depends_on:
      postgis:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../apps/worker:/app
    command: uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  postgis_data:
```

**Step 2: Start Docker Compose and verify**

```bash
cd /Users/tbmkhabela/Projects/FGP
docker compose -f infra/docker-compose.yml up -d
```

Expected: All 3 containers start. Check with:

```bash
docker compose -f infra/docker-compose.yml ps
```

Expected: All services show `running` or `healthy`.

**Step 3: Verify PostGIS**

```bash
docker compose -f infra/docker-compose.yml exec postgis psql -U postgres -c "SELECT PostGIS_Version();"
```

Expected: Something like `3.4.x ...`

**Step 4: Verify worker health via Docker**

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok","version":"0.1.0","tariff_year":2026}`

**Step 5: Stop Docker Compose**

```bash
docker compose -f infra/docker-compose.yml down
```

**Step 6: Commit**

```bash
cd /Users/tbmkhabela/Projects/FGP
git add infra/
git commit -m "feat: add Docker Compose for PostGIS + Redis + worker"
```

---

## Task 6: Supabase CLI setup + DB schema migration

**Files:**
- Install Supabase CLI
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/0001_initial.sql`

**Step 1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
```

Verify:
```bash
supabase --version
```

Expected: `2.x.x` or similar.

**Step 2: Initialize Supabase in project root**

```bash
cd /Users/tbmkhabela/Projects/FGP
supabase init
```

This creates the `supabase/` directory with a default `config.toml`.

**Step 3: Create the initial migration**

```bash
supabase migration new initial_schema
```

This creates `supabase/migrations/<timestamp>_initial_schema.sql`. Rename it for clarity:
```bash
mv supabase/migrations/*_initial_schema.sql supabase/migrations/0001_initial.sql
```

**Step 4: Populate `supabase/migrations/0001_initial.sql`**

Copy the full SQL schema from CLAUDE.md section 4. Here it is verbatim:

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- =============================================
-- SPATIAL LAYERS
-- =============================================

CREATE TABLE parcels (
  id              BIGSERIAL PRIMARY KEY,
  erf_number      TEXT NOT NULL,
  township        TEXT,
  province        TEXT DEFAULT 'Gauteng',
  municipality    TEXT,
  size_sqm        NUMERIC,
  boundary        GEOGRAPHY(POLYGON, 4326) NOT NULL,
  centroid        GEOGRAPHY(POINT, 4326),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX parcels_boundary_idx ON parcels USING GIST(boundary);
CREATE INDEX parcels_centroid_idx ON parcels USING GIST(centroid);

CREATE TABLE zoning_designations (
  id              BIGSERIAL PRIMARY KEY,
  municipality    TEXT NOT NULL,
  zone_code       TEXT NOT NULL,
  zone_label      TEXT,
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  scheme_year     INTEGER,
  source_url      TEXT,
  last_updated    DATE
);
CREATE INDEX zoning_geometry_idx ON zoning_designations USING GIST(geometry);

CREATE TABLE zoning_scheme_rules (
  id                      SERIAL PRIMARY KEY,
  municipality            TEXT NOT NULL,
  zone_code               TEXT NOT NULL,
  zone_label              TEXT,
  max_units_per_ha        INTEGER,
  max_units_per_erf       INTEGER,
  coverage_pct            NUMERIC,
  far                     NUMERIC,
  max_height_m            NUMERIC,
  max_storeys             INTEGER,
  building_line_front_m   NUMERIC,
  building_line_side_m    NUMERIC,
  building_line_rear_m    NUMERIC,
  permitted_uses          TEXT[],
  consent_uses            TEXT[],
  rezoning_possible_to    TEXT[],
  rezoning_difficulty     TEXT CHECK (rezoning_difficulty IN ('low', 'medium', 'high')),
  rezoning_approval_rate  NUMERIC,
  forms_required          TEXT[],
  scheme_document         TEXT,
  scheme_year             INTEGER,
  last_updated            DATE,
  UNIQUE(municipality, zone_code)
);

CREATE TABLE dolomite_zones (
  id              BIGSERIAL PRIMARY KEY,
  risk_class      TEXT NOT NULL CHECK (risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7')),
  geometry        GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  cgs_reference   TEXT,
  notes           TEXT
);
CREATE INDEX dolomite_geometry_idx ON dolomite_zones USING GIST(geometry);

CREATE TABLE land_use_hexagons (
  id              BIGSERIAL PRIMARY KEY,
  h3_index        TEXT UNIQUE,
  land_use_class  TEXT,
  pop_2026_est    INTEGER,
  socioeco_risk   NUMERIC,
  new_dev_flag    BOOLEAN DEFAULT FALSE,
  geometry        GEOGRAPHY(POLYGON, 4326),
  year            INTEGER
);

CREATE TABLE amenities (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  subtype         TEXT,
  geometry        GEOGRAPHY(POINT, 4326) NOT NULL,
  source          TEXT
);
CREATE INDEX amenities_geometry_idx ON amenities USING GIST(geometry);

-- =============================================
-- LISTINGS
-- =============================================

CREATE TABLE listings (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  source_id       TEXT,
  source_url      TEXT,
  scraped_at      TIMESTAMPTZ,
  address         TEXT,
  suburb          TEXT,
  city            TEXT,
  municipality    TEXT,
  coordinates     GEOGRAPHY(POINT, 4326),
  size_sqm        NUMERIC,
  price           NUMERIC,
  price_per_sqm   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN size_sqm > 0 THEN price / size_sqm ELSE NULL END
  ) STORED,
  listing_type    TEXT DEFAULT 'vacant_land',
  description     TEXT,
  parcel_id       BIGINT REFERENCES parcels(id),
  zone_code       TEXT,
  dolomite_risk   TEXT,
  status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzing', 'analyzed', 'active_project', 'dismissed', 'sold')),
  feasibility_score INTEGER CHECK (feasibility_score BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FEASIBILITY
-- =============================================

CREATE TABLE feasibility_reports (
  id                    BIGSERIAL PRIMARY KEY,
  listing_id            BIGINT REFERENCES listings(id) NOT NULL,
  user_id               UUID,
  unit_type             TEXT NOT NULL,
  target_units          INTEGER NOT NULL,
  build_rate_per_sqm    NUMERIC NOT NULL DEFAULT 13500,
  tariff_year           INTEGER NOT NULL DEFAULT 2026,
  max_units_allowed     INTEGER,
  max_buildable_sqm     NUMERIC,
  max_footprint_sqm     NUMERIC,
  rezoning_required     BOOLEAN DEFAULT FALSE,
  cost_land             NUMERIC,
  cost_build            NUMERIC,
  cost_professional_fees NUMERIC,
  cost_bulk_contributions NUMERIC,
  cost_transfer_duty    NUMERIC,
  cost_total            NUMERIC,
  rent_per_unit_monthly NUMERIC,
  gross_monthly_income  NUMERIC,
  gross_annual_income   NUMERIC,
  yield_gross_pct       NUMERIC,
  yield_at_85_occ_pct   NUMERIC,
  viable                BOOLEAN,
  viability_notes       TEXT,
  score_schools         INTEGER,
  score_transport       INTEGER,
  score_amenities       INTEGER,
  pdf_package_url       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPLIANCE DOCUMENTS
-- =============================================

CREATE TABLE compliance_documents (
  id              BIGSERIAL PRIMARY KEY,
  report_id       BIGINT REFERENCES feasibility_reports(id),
  listing_id      BIGINT REFERENCES listings(id),
  doc_type        TEXT NOT NULL,
  municipality    TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'approved', 'rejected')),
  prefilled_data  JSONB,
  pdf_url         TEXT,
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROJECTS
-- =============================================

CREATE TABLE projects (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID,
  listing_id      BIGINT REFERENCES listings(id),
  report_id       BIGINT REFERENCES feasibility_reports(id),
  name            TEXT,
  status          TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'compliance', 'approved', 'construction', 'complete', 'stalled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SCRAPER JOBS
-- =============================================

CREATE TABLE scrape_jobs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  search_params   JSONB,
  status          TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  listings_found  INTEGER DEFAULT 0,
  listings_new    INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Step 5: Start Supabase and apply migration**

```bash
cd /Users/tbmkhabela/Projects/FGP
supabase start
```

This starts local Supabase (Postgres, Auth, Studio). Takes ~1 minute first time. At the end it prints API URL, anon key, service role key — copy these into `.env.local` (create from `.env.example`).

Then apply the migration:
```bash
supabase db push
```

Expected: `Applying migration 0001_initial.sql... done.`

**Step 6: Verify the schema was applied**

```bash
supabase db diff
```

Expected: No diff (schema matches migrations).

**Step 7: Check that all tables exist**

```bash
supabase db reset --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt"
```

Expected: Lists all tables: parcels, zoning_designations, zoning_scheme_rules, dolomite_zones, land_use_hexagons, amenities, listings, feasibility_reports, compliance_documents, projects, scrape_jobs.

**Step 8: Create `.env.local` for web app**

```bash
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local` with values from `supabase status`:
- `NEXT_PUBLIC_SUPABASE_URL` = the API URL (e.g. `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key printed by `supabase start`

**Step 9: Commit**

```bash
cd /Users/tbmkhabela/Projects/FGP
git add supabase/
git commit -m "feat: add Supabase CLI config and initial DB schema migration"
```

---

## Task 7: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  web:
    name: Web — typecheck + lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

  worker:
    name: Worker — lint + typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v5
        with:
          version: "0.10.2"

      - name: Set up Python
        working-directory: apps/worker
        run: uv python install

      - name: Install dependencies
        working-directory: apps/worker
        run: uv sync --extra dev

      - name: Lint (ruff)
        working-directory: apps/worker
        run: uv run ruff check .

      - name: Type check (pyright)
        working-directory: apps/worker
        run: uv run pyright .
```

**Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    name: Deploy web to Vercel
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_WORKER_URL: ${{ secrets.NEXT_PUBLIC_WORKER_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
          vercel-args: --prod

  # deploy-worker:
  #   name: Deploy worker to AWS ECS
  #   runs-on: ubuntu-latest
  #   # TODO: Uncomment when infra/terraform is set up
  #   steps:
  #     - uses: actions/checkout@v4
  #     - name: Configure AWS credentials
  #       uses: aws-actions/configure-aws-credentials@v4
  #       with:
  #         aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
  #         aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  #         aws-region: af-south-1
  #     - name: Build and push to ECR
  #       run: |
  #         aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
  #         docker build -t fgp-worker apps/worker/
  #         docker push $ECR_REGISTRY/fgp-worker:latest
  #     - name: Deploy to ECS
  #       run: aws ecs update-service --cluster fgp --service worker --force-new-deployment
```

**Step 3: Commit**

```bash
cd /Users/tbmkhabela/Projects/FGP
git add .github/
git commit -m "chore: add GitHub Actions CI and deploy workflows"
```

---

## Task 8: Empty script directories + final verification

**Files:**
- Create: `scripts/seed/.gitkeep`
- Create: `scripts/scrapers/.gitkeep`

**Step 1: Create placeholder dirs**

```bash
mkdir -p scripts/seed scripts/scrapers
touch scripts/seed/.gitkeep scripts/scrapers/.gitkeep
```

**Step 2: Final end-to-end verification checklist**

Run each command and verify the expected output:

```bash
# 1. Next.js starts
pnpm dev
# Expected: ✓ Ready on http://localhost:3000
# Ctrl+C

# 2. Worker starts
cd apps/worker && uv run uvicorn main:app --port 8000
# Expected: INFO: Application startup complete.
# In another terminal: curl http://localhost:8000/health → {"status":"ok",...}
# Ctrl+C, cd ../..

# 3. Docker Compose runs
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
# Expected: postgis (healthy), redis (healthy), worker (running)
docker compose -f infra/docker-compose.yml down

# 4. Supabase is running
supabase status
# Expected: API URL, Studio URL, anon key, service role key

# 5. Typecheck passes
pnpm typecheck
# Expected: no errors

# 6. Python lint passes
cd apps/worker && uv run ruff check .
# Expected: All checks passed.
```

**Step 3: Final commit**

```bash
cd /Users/tbmkhabela/Projects/FGP
git add scripts/
git commit -m "chore: add empty script directories for Phase 1 seed and scrapers"
```

---

---

## Task 9: Convert mockup to real Next.js pages

The file `first-gen-properties-mockup.jsx` in the project root contains the full UI design as a single-file React component with inline styles. This task converts each screen into a proper Next.js App Router page using Tailwind classes.

**Source file:** `/Users/tbmkhabela/Projects/FGP/first-gen-properties-mockup.jsx`

**Files to create:**
- `apps/web/components/DolomiteBadge.tsx`
- `apps/web/components/ScoreBadge.tsx`
- `apps/web/components/MapPlaceholder.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/scout/page.tsx`
- `apps/web/app/scout/[id]/page.tsx`
- `apps/web/app/scout/[id]/zoning/page.tsx`
- `apps/web/app/scout/[id]/cost/page.tsx`

**Files to modify:**
- `apps/web/app/layout.tsx` — update nav links to match real routes

**Conversion rules (apply to every component):**
- Replace all `style={{...}}` with Tailwind classes using the design token config from Task 3
- `fontFamily: "'DM Mono', monospace"` → `font-mono`
- `fontFamily: "'Playfair Display', serif"` → `font-heading`
- `background: "#0f172a"` → `bg-bg-surface`
- `background: "#070d1a"` → `bg-bg-base`
- `background: "#0d1929"` → `bg-bg-elevated`
- `border: "1px solid #1e293b"` → `border border-border`
- `color: "#f1f5f9"` → `text-text-primary`
- `color: "#64748b"` → `text-text-muted`
- `color: "#3b82f6"` → `text-accent-blue`
- `color: "#22c55e"` → `text-accent-green`
- `color: "#f59e0b"` → `text-accent-amber`
- `color: "#ef4444"` → `text-accent-red`
- All `onClick={() => onNavigate(...)}` → `<Link href="...">` from `next/link` (no JS navigation)
- All `onMouseEnter`/`onMouseLeave` hover handlers → Tailwind `hover:` variants
- Mark all pages `"use client"` only if they have `useState`; otherwise server components

---

### Sub-task 9a: Shared components

**Step 1: Create `apps/web/components/DolomiteBadge.tsx`**

```tsx
interface Props {
  risk: "LOW" | "MEDIUM" | "HIGH";
}

const styles: Record<Props["risk"], string> = {
  LOW: "bg-accent-green/10 text-accent-green border-accent-green/25",
  MEDIUM: "bg-accent-amber/10 text-accent-amber border-accent-amber/25",
  HIGH: "bg-accent-red/10 text-accent-red border-accent-red/25",
};

export function DolomiteBadge({ risk }: Props) {
  return (
    <span
      className={`${styles[risk]} border rounded px-2 py-0.5 text-[11px] font-mono font-semibold tracking-widest`}
    >
      {risk} RISK
    </span>
  );
}
```

**Step 2: Create `apps/web/components/ScoreBadge.tsx`**

```tsx
interface Props {
  score: number;
}

export function ScoreBadge({ score }: Props) {
  const color =
    score >= 80
      ? "border-accent-green text-accent-green"
      : score >= 60
        ? "border-accent-amber text-accent-amber"
        : "border-accent-red text-accent-red";

  return (
    <div
      className={`w-9 h-9 rounded-full border-2 ${color} flex items-center justify-center text-xs font-bold font-mono`}
    >
      {score}
    </div>
  );
}
```

**Step 3: Create `apps/web/components/MapPlaceholder.tsx`**

```tsx
interface Props {
  label: string;
}

export function MapPlaceholder({ label }: Props) {
  return (
    <div className="bg-bg-surface rounded-card overflow-hidden relative h-full min-h-[200px] flex items-center justify-center">
      {/* Grid lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15"
        aria-hidden="true"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={`${i * 10}%`}
            x2="100%"
            y2={`${i * 10}%`}
            stroke="#3b82f6"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={`${i * 10}%`}
            y1="0"
            x2={`${i * 10}%`}
            y2="100%"
            stroke="#3b82f6"
            strokeWidth="0.5"
          />
        ))}
      </svg>

      {/* Simulated parcel shapes */}
      <svg
        className="absolute inset-0 w-full h-full opacity-60"
        aria-hidden="true"
      >
        <rect x="20%" y="30%" width="15%" height="20%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="37%" y="28%" width="12%" height="18%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="51%" y="32%" width="18%" height="22%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="20%" y="52%" width="25%" height="18%" rx="2" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
        <rect x="37%" y="48%" width="14%" height="20%" rx="2" fill="#1d4ed840" stroke="#3b82f6" strokeWidth="2" />
        <ellipse cx="70%" cy="55%" rx="12%" ry="10%" fill="#ef444420" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" />
      </svg>

      {/* Pin + label */}
      <div className="z-10 text-center">
        <div className="text-3xl">📍</div>
        <div className="text-accent-blue text-xs font-mono bg-black/50 px-2 py-0.5 rounded mt-1">
          {label}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {[
          { color: "bg-accent-blue/25 border-accent-blue", label: "Parcel boundary" },
          { color: "bg-accent-red/25 border-accent-red", label: "Dolomite zone" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono">
            <div className={`w-2.5 h-2.5 rounded-sm ${l.color} border`} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 left-3 text-[9px] text-text-dim font-mono">
        © MapLibre · © OpenStreetMap
      </div>
    </div>
  );
}
```

**Step 4: Verify typecheck**

```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm typecheck
```

Expected: No errors.

**Step 5: Commit**

```bash
git add apps/web/components/
git commit -m "feat: add DolomiteBadge, ScoreBadge, and MapPlaceholder components"
```

---

### Sub-task 9b: Dashboard page

**Step 1: Create `apps/web/app/dashboard/page.tsx`**

Convert the `Dashboard` component from the mockup. This component has no state so it's a server component (no `"use client"`).

```tsx
import Link from "next/link";
import { DolomiteBadge } from "@/components/DolomiteBadge";
import { ScoreBadge } from "@/components/ScoreBadge";
import { MapPlaceholder } from "@/components/MapPlaceholder";

const leads = [
  { erf: "ERF 1247", area: "Noordwyk, Midrand", size: 1024, price: 980000, zone: "RES3", dolomite: "LOW" as const, yield: 14.2, score: 92 },
  { erf: "ERF 882", area: "Halfway House, Midrand", size: 800, price: 720000, zone: "RES2", dolomite: "LOW" as const, yield: 11.8, score: 74 },
  { erf: "ERF 3301", area: "Centurion CBD", size: 1500, price: 1800000, zone: "RES4", dolomite: "HIGH" as const, yield: 18.1, score: 61 },
  { erf: "ERF 219", area: "Karenpark, Pretoria", size: 600, price: 390000, zone: "RES1", dolomite: "LOW" as const, yield: 9.4, score: 48 },
  { erf: "ERF 554", area: "Soshanguve Block X", size: 900, price: 510000, zone: "RES2", dolomite: "LOW" as const, yield: 16.7, score: 88 },
];

const kpis = [
  { label: "Leads Tracked", value: "47", delta: "+12 this week", color: "bg-accent-blue" },
  { label: "Viable Parcels", value: "18", delta: "Score ≥ 70", color: "bg-accent-green" },
  { label: "Avg Yield", value: "13.4%", delta: "Across portfolio", color: "bg-purple-500" },
  { label: "Forms Ready", value: "11", delta: "Pre-filled", color: "bg-accent-amber" },
];

const quickActions = [
  { icon: "🔍", label: "Run Scout", desc: "Pull new listings from Property24", href: "/scout" },
  { icon: "📄", label: "Generate Forms", desc: "Pre-fill compliance package", href: "/scout/1247/zoning" },
  { icon: "💰", label: "Cost Oracle", desc: "Run full ROI analysis", href: "/scout/1247/cost" },
];

export default function DashboardPage() {
  return (
    <div className="p-8 flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-bg-surface border border-border rounded-card p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${k.color} opacity-70`} />
            <div className="text-[11px] font-mono text-text-muted tracking-[0.8px] uppercase mb-2">{k.label}</div>
            <div className="font-heading text-[32px] text-text-primary font-bold mb-1">{k.value}</div>
            <div className={`text-[11px] font-mono text-accent-blue`}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Recent leads + map */}
      <div className="grid grid-cols-[1fr_1.2fr] gap-4 h-[360px]">
        <div className="bg-bg-surface border border-border rounded-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center">
            <span className="text-text-primary font-mono text-xs tracking-[0.8px] uppercase">Recent Leads</span>
            <Link
              href="/scout"
              className="bg-accent-blue/10 border border-accent-blue/25 text-accent-blue rounded px-3 py-1 text-[11px] font-mono hover:bg-accent-blue/20 transition-colors"
            >
              VIEW ALL →
            </Link>
          </div>
          <div className="overflow-auto flex-1">
            {leads.map((lead, i) => (
              <Link
                key={i}
                href="/scout/1247"
                className="px-5 py-3 border-b border-border/50 flex items-center justify-between hover:bg-border/30 transition-colors"
              >
                <div>
                  <div className="text-text-primary text-[13px] font-semibold font-mono">{lead.erf}</div>
                  <div className="text-text-muted text-[11px] mt-0.5">{lead.area} · {lead.size}m²</div>
                </div>
                <div className="flex items-center gap-3">
                  <DolomiteBadge risk={lead.dolomite} />
                  <span className="text-accent-green font-mono text-xs font-bold">{lead.yield}%</span>
                  <ScoreBadge score={lead.score} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-card overflow-hidden border border-border h-full">
          <MapPlaceholder label="Gauteng Coverage" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="bg-bg-surface border border-border rounded-card p-5 flex items-center gap-3.5 hover:border-accent-blue/25 transition-colors"
          >
            <div className="text-3xl">{a.icon}</div>
            <div>
              <div className="text-text-primary text-[13px] font-bold font-mono">{a.label}</div>
              <div className="text-text-muted text-[11px] mt-0.5">{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Update `apps/web/app/layout.tsx` nav links**

Replace the nav section in `layout.tsx` to match real routes:

```tsx
{[
  { label: "Dashboard", href: "/dashboard" },
  { label: "Scout", href: "/scout" },
  { label: "Projects", href: "/projects" },
  { label: "Settings", href: "/settings/scraper" },
].map((item) => (
  <a
    key={item.label}
    href={item.href}
    className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-text-muted hover:text-text-primary hover:bg-border transition-colors"
  >
    {item.label.toUpperCase()}
  </a>
))}
```

**Step 3: Update root `page.tsx` to redirect to `/dashboard`**

Replace `apps/web/app/page.tsx` with:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

**Step 4: Verify in browser**

```bash
pnpm dev
```

Open http://localhost:3000 — should redirect to `/dashboard`. Verify: 4 KPI cards, leads list, map placeholder, 3 quick action cards. All in dark theme.

**Step 5: Commit**

```bash
git add apps/web/app/dashboard/ apps/web/app/layout.tsx apps/web/app/page.tsx
git commit -m "feat: add dashboard page converted from mockup"
```

---

### Sub-task 9c: Scout page

**Step 1: Create `apps/web/app/scout/page.tsx`**

This page has `useState` for the active filter, so it needs `"use client"`.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { DolomiteBadge } from "@/components/DolomiteBadge";
import { ScoreBadge } from "@/components/ScoreBadge";
import { MapPlaceholder } from "@/components/MapPlaceholder";

const leads = [
  { id: "1247", erf: "ERF 1247", area: "Noordwyk, Midrand", size: 1024, price: 980000, zone: "RES3", dolomite: "LOW" as const, yield: 14.2, score: 92 },
  { id: "882", erf: "ERF 882", area: "Halfway House, Midrand", size: 800, price: 720000, zone: "RES2", dolomite: "LOW" as const, yield: 11.8, score: 74 },
  { id: "3301", erf: "ERF 3301", area: "Centurion CBD", size: 1500, price: 1800000, zone: "RES4", dolomite: "HIGH" as const, yield: 18.1, score: 61 },
  { id: "219", erf: "ERF 219", area: "Karenpark, Pretoria", size: 600, price: 390000, zone: "RES1", dolomite: "LOW" as const, yield: 9.4, score: 48 },
  { id: "554", erf: "ERF 554", area: "Soshanguve Block X", size: 900, price: 510000, zone: "RES2", dolomite: "LOW" as const, yield: 16.7, score: 88 },
];

const FILTERS = ["all", "RES2", "RES3", "RES4", "LOW dolomite", "Score ≥80"];

export default function ScoutPage() {
  const [filter, setFilter] = useState("all");

  return (
    <div className="p-8 flex flex-col gap-5">
      {/* Search bar */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 bg-bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-2.5">
          <span className="text-text-muted">🔍</span>
          <span className="text-text-dim font-mono text-[13px]">
            Search Midrand, Pretoria... filter by zone, size, price
          </span>
        </div>
        <button className="bg-accent-blue border-none rounded-xl px-5 py-3 text-white font-mono text-xs font-bold cursor-pointer hover:bg-blue-500 transition-colors">
          SCRAPE NOW
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border rounded-pill px-3.5 py-1 text-[11px] font-mono cursor-pointer transition-colors ${
              filter === f
                ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
                : "bg-transparent border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Grid + map */}
      <div className="grid grid-cols-2 gap-4 min-h-[420px]">
        <div className="flex flex-col gap-2.5">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/scout/${lead.id}`}
              className="bg-bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-accent-blue/40 hover:bg-[#111827] transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-text-primary font-mono text-sm font-bold">
                    {lead.erf} · {lead.area}
                  </div>
                  <div className="text-text-muted text-xs mt-1">
                    {lead.size}m² · R{(lead.price / 1000).toFixed(0)}k · R{Math.round(lead.price / lead.size)}/m²
                  </div>
                </div>
                <ScoreBadge score={lead.score} />
              </div>
              <div className="flex gap-2 items-center">
                <span className="bg-border rounded px-2 py-0.5 text-[11px] text-text-muted font-mono">
                  {lead.zone}
                </span>
                <DolomiteBadge risk={lead.dolomite} />
                <span className="ml-auto text-accent-green font-mono text-[13px] font-bold">
                  {lead.yield}% yield
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-card overflow-hidden border border-border h-full">
          <MapPlaceholder label="Midrand / Pretoria Leads" />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

```bash
pnpm dev
```

Open http://localhost:3000/scout. Verify: search bar, filter pills (clickable, active state changes), 5 lead cards, map placeholder.

**Step 3: Commit**

```bash
git add apps/web/app/scout/
git commit -m "feat: add scout page converted from mockup"
```

---

### Sub-task 9d: Parcel Detail page

**Step 1: Create `apps/web/app/scout/[id]/page.tsx`**

The unit type toggle has state, so this needs `"use client"`.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { DolomiteBadge } from "@/components/DolomiteBadge";
import { MapPlaceholder } from "@/components/MapPlaceholder";

const mockParcel = {
  erf: "ERF 1247",
  township: "Noordwyk Ext 19",
  size: 1024,
  municipality: "City of Johannesburg",
  zone: "Residential 3",
  zoneCode: "RES3",
  dolomite: "LOW" as const,
  address: "14 Glenferness Ave, Midrand, 1685",
  price: 980000,
  pricePerSqm: 957,
};

const zoningRules = {
  zone: "Residential 3",
  coverage: 60,
  far: 1.5,
  maxStoreys: 3,
  buildingLineFront: 3,
  buildingLineSide: 2,
  buildingLineRear: 2,
  derivedMaxUnits: 8,
  derivedMaxBuildable: 1536,
  derivedMaxFootprint: 614,
};

const unitOptions = [
  { type: "Bachelor", units: 8, sqm: 35, rental: 6800 },
  { type: "1-Bed", units: 6, sqm: 55, rental: 9200 },
  { type: "2-Bed", units: 4, sqm: 85, rental: 13500 },
];

export default function ParcelDetailPage({ params }: { params: { id: string } }) {
  const [activeUnit, setActiveUnit] = useState(0);

  return (
    <div className="p-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-1.5">
            Parcel Profile
          </div>
          <h1 className="font-heading text-[26px] text-text-primary font-bold">
            {mockParcel.erf}, {mockParcel.township}
          </h1>
          <div className="text-text-muted text-[13px] mt-1 font-mono">{mockParcel.address}</div>
        </div>
        <div className="flex gap-2.5 items-center">
          <DolomiteBadge risk={mockParcel.dolomite} />
          <Link
            href={`/scout/${params.id}/zoning`}
            className="bg-accent-blue text-white rounded-lg px-5 py-2.5 text-xs font-mono font-bold hover:bg-blue-500 transition-colors"
          >
            VIEW FORMS →
          </Link>
          <Link
            href={`/scout/${params.id}/cost`}
            className="bg-accent-green/10 border border-accent-green/25 text-accent-green rounded-lg px-5 py-2.5 text-xs font-mono font-bold hover:bg-accent-green/20 transition-colors"
          >
            COST ORACLE →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-3.5">
          {/* Parcel facts */}
          <div className="bg-bg-surface border border-border rounded-card p-5">
            <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-3.5">
              Parcel Facts
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "ERF Size", value: `${mockParcel.size} m²` },
                { label: "Price", value: `R${(mockParcel.price / 1000).toFixed(0)}k` },
                { label: "Price/m²", value: `R${mockParcel.pricePerSqm}` },
                { label: "Municipality", value: mockParcel.municipality },
                { label: "Zone", value: mockParcel.zone },
                { label: "Dolomite", value: `${mockParcel.dolomite} RISK` },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-[10px] font-mono text-text-dim tracking-[0.8px] uppercase">
                    {f.label}
                  </div>
                  <div className="text-[14px] font-mono text-text-primary font-semibold mt-0.5">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zoning rules */}
          <div className="bg-bg-surface border border-border rounded-card p-5">
            <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-3.5">
              Zoning Rules · {zoningRules.zone}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3.5">
              {[
                { label: "Coverage", value: `${zoningRules.coverage}%` },
                { label: "FAR", value: zoningRules.far },
                { label: "Max Storeys", value: zoningRules.maxStoreys },
                { label: "Front Line", value: `${zoningRules.buildingLineFront}m` },
                { label: "Side Line", value: `${zoningRules.buildingLineSide}m` },
                { label: "Rear Line", value: `${zoningRules.buildingLineRear}m` },
              ].map((f) => (
                <div key={f.label} className="bg-bg-elevated rounded-lg p-2.5">
                  <div className="text-[9px] font-mono text-text-dim tracking-[1px] uppercase">
                    {f.label}
                  </div>
                  <div className="text-lg font-mono text-accent-blue font-bold mt-1">{f.value}</div>
                </div>
              ))}
            </div>

            {/* Derived potential */}
            <div className="bg-[#0d2818] border border-green-800/30 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-text-muted tracking-[1px] uppercase mb-1.5">
                Derived Potential
              </div>
              <div className="flex gap-5">
                {[
                  { value: zoningRules.derivedMaxUnits, label: "MAX UNITS" },
                  { value: `${zoningRules.derivedMaxBuildable}m²`, label: "MAX BUILDABLE" },
                  { value: `${zoningRules.derivedMaxFootprint}m²`, label: "MAX FOOTPRINT" },
                ].map((d) => (
                  <div key={d.label}>
                    <div className="text-accent-green text-xl font-mono font-bold">{d.value}</div>
                    <div className="text-text-muted text-[10px] font-mono">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          <div className="flex-1 rounded-card overflow-hidden border border-border min-h-[200px]">
            <MapPlaceholder label={`${mockParcel.erf} · Noordwyk`} />
          </div>

          {/* Unit type selector */}
          <div className="bg-bg-surface border border-border rounded-card p-4">
            <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-3">
              Parametric Unit Toggle
            </div>
            <div className="flex gap-2 mb-3.5">
              {unitOptions.map((u, i) => (
                <button
                  key={u.type}
                  onClick={() => setActiveUnit(i)}
                  className={`flex-1 rounded-lg p-2.5 text-center border transition-colors ${
                    i === activeUnit
                      ? "bg-accent-blue/10 border-accent-blue"
                      : "bg-bg-elevated border-border hover:border-border/80"
                  }`}
                >
                  <div className={`font-mono text-[13px] font-bold ${i === activeUnit ? "text-accent-blue" : "text-text-muted"}`}>
                    {u.units}x
                  </div>
                  <div className={`font-mono text-[11px] mt-0.5 ${i === activeUnit ? "text-text-primary" : "text-text-muted"}`}>
                    {u.type}
                  </div>
                  <div className="text-text-dim text-[10px] font-mono mt-0.5">
                    {u.sqm}m² · R{(u.rental / 1000).toFixed(1)}k/mo
                  </div>
                </button>
              ))}
            </div>

            {/* 3D massing preview (SVG placeholder — Three.js in Phase 3) */}
            <div className="bg-[#060f1e] rounded-lg h-[90px] flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 200 80" className="w-full h-full">
                <ellipse cx="100" cy="65" rx="80" ry="12" fill="#1e293b" />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i} transform={`translate(${30 + i * 38}, 0)`}>
                    <rect x="0" y="25" width="30" height="38" fill="#1d4ed8" opacity="0.8" />
                    <rect x="0" y="23" width="30" height="5" fill="#3b82f6" opacity="0.9" />
                    <rect x="30" y="26" width="6" height="37" fill="#1e40af" opacity="0.7" />
                  </g>
                ))}
                <ellipse cx="100" cy="65" rx="75" ry="8" fill="#000" opacity="0.3" />
              </svg>
              <div className="absolute bottom-1.5 right-2.5 text-[9px] font-mono text-accent-blue">
                3D MASSING · THREE.JS
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

```bash
pnpm dev
```

Open http://localhost:3000/scout/1247. Verify: parcel facts grid, zoning rules with blue stat cards, derived potential panel, map, unit toggle (clicking switches active button), SVG massing preview.

**Step 3: Commit**

```bash
git add apps/web/app/scout/
git commit -m "feat: add parcel detail page with unit toggle"
```

---

### Sub-task 9e: Zoning + Forms page

**Step 1: Create `apps/web/app/scout/[id]/zoning/page.tsx`**

Has `useState` for accordion expand, so `"use client"`.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

const forms = [
  {
    name: "Zoning Certificate Application",
    body: "City of Johannesburg",
    status: "ready",
    fields: ["ERF 1247", "Noordwyk Ext 19", "Residential 3", "1024 m²"],
    icon: "📋",
  },
  {
    name: "Building Plan Submission Checklist",
    body: "JHB Building Control",
    status: "ready",
    fields: ["FAR: 1.5", "Coverage: 60%", "Height: 3 storeys", "Dolomite Risk: LOW"],
    icon: "🏗️",
  },
  {
    name: "Motivation Letter – Res 3 Compliance",
    body: "Pre-filled template",
    status: "ready",
    fields: ["ERF 1247", "8 Bachelor Units", "R4.2M Build Cost", "14.2% Yield"],
    icon: "📝",
  },
  {
    name: "Dolomite Risk Declaration",
    body: "Council for Geoscience",
    status: "ready",
    fields: ["Risk Category: LOW", "CGS ENGEODE Ref", "No sinkhole incidents"],
    icon: "⚠️",
  },
];

const checklist = [
  { step: "Obtain Zoning Certificate", done: true, time: "5-10 days" },
  { step: "Dolomite Stability Report", done: true, time: "CGS verified" },
  { step: "Pre-application Consult", done: false, time: "Book with JHB" },
  { step: "Submit Building Plans", done: false, time: "After consent" },
  { step: "Eng. Services Impact Check", done: false, time: "30-60 days" },
  { step: "Final HOA Consent", done: false, time: "If applicable" },
];

export default function ZoningPage({ params }: { params: { id: string } }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="p-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-1.5">
            Compliance Package
          </div>
          <h1 className="font-heading text-[24px] text-text-primary font-bold">
            Zoning &amp; Required Forms
          </h1>
          <div className="text-text-muted text-xs mt-1 font-mono">
            ERF 1247, Noordwyk · City of Johannesburg · Res 3
          </div>
        </div>
        <button className="bg-accent-amber text-black rounded-lg px-5 py-2.5 text-xs font-mono font-bold hover:bg-amber-400 transition-colors">
          ↓ EXPORT ALL PDFs
        </button>
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        {/* Forms list */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-0.5">
            Auto-Populated Forms ({forms.length})
          </div>
          {forms.map((form, i) => (
            <div
              key={i}
              className={`bg-bg-surface border rounded-card overflow-hidden transition-colors ${
                expanded === i ? "border-accent-blue" : "border-border"
              }`}
            >
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full px-5 py-4 flex items-center gap-3.5 cursor-pointer text-left hover:bg-border/20 transition-colors"
              >
                <div className="text-[22px]">{form.icon}</div>
                <div className="flex-1">
                  <div className="text-text-primary text-[13px] font-bold font-mono">{form.name}</div>
                  <div className="text-text-muted text-[11px] mt-0.5">{form.body}</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="bg-accent-green/10 text-accent-green border border-accent-green/25 rounded px-2 py-0.5 text-[10px] font-mono">
                    READY
                  </span>
                  <span className="text-text-muted text-xs">{expanded === i ? "▲" : "▼"}</span>
                </div>
              </button>

              {expanded === i && (
                <div className="px-5 pb-4 border-t border-border">
                  <div className="text-[10px] font-mono text-text-dim tracking-[1px] uppercase mb-2 mt-3">
                    Pre-filled Fields
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.fields.map((f) => (
                      <span
                        key={f}
                        className="bg-border rounded px-2.5 py-1 text-[11px] font-mono text-text-muted"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="bg-accent-blue/10 border border-accent-blue/25 text-accent-blue rounded px-3.5 py-1.5 text-[11px] font-mono hover:bg-accent-blue/20 transition-colors">
                      PREVIEW PDF
                    </button>
                    <button className="bg-accent-amber/10 border border-accent-amber/25 text-accent-amber rounded px-3.5 py-1.5 text-[11px] font-mono hover:bg-accent-amber/20 transition-colors">
                      DOWNLOAD
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          {/* Compliance checklist */}
          <div className="bg-bg-surface border border-border rounded-card p-5">
            <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-3.5">
              Compliance Checklist
            </div>
            {checklist.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-2.5 ${i < checklist.length - 1 ? "border-b border-border/50" : ""}`}
              >
                <div
                  className={`w-[18px] h-[18px] rounded mt-0.5 flex-shrink-0 flex items-center justify-center border-2 ${
                    item.done
                      ? "bg-accent-green border-accent-green"
                      : "bg-transparent border-slate-600"
                  }`}
                >
                  {item.done && <span className="text-black text-[11px] font-bold">✓</span>}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-xs font-mono ${
                      item.done
                        ? "text-text-muted line-through"
                        : "text-text-primary"
                    }`}
                  >
                    {item.step}
                  </div>
                  <div className="text-text-dim text-[10px] font-mono mt-0.5">{item.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Rezoning opportunity */}
          <div className="bg-bg-elevated border border-accent-blue/20 rounded-card p-4.5">
            <div className="text-[11px] font-mono text-accent-blue tracking-[1px] uppercase mb-2.5">
              Rezoning Opportunity
            </div>
            <div className="text-text-primary text-[13px] font-mono mb-2">RES3 → RES4 possible</div>
            <p className="text-text-muted text-xs leading-relaxed">
              Rezoning to Res 4 (up to 41–120 units/ha) would unlock up to 12 units on this erf.
              Difficulty rated MEDIUM — similar applications in Noordwyk have a 68% approval rate.
            </p>
            <button className="mt-3 bg-accent-blue/10 border border-accent-blue/25 text-accent-blue rounded px-4 py-2 text-[11px] font-mono hover:bg-accent-blue/20 transition-colors">
              GENERATE REZONING APPLICATION →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

```bash
pnpm dev
```

Open http://localhost:3000/scout/1247/zoning. Verify: 4 accordion form cards (clicking expands/collapses), compliance checklist with checked items, rezoning opportunity card.

**Step 3: Commit**

```bash
git add apps/web/app/scout/1247/
git commit -m "feat: add zoning and forms page converted from mockup"
```

---

### Sub-task 9f: Cost Oracle page

**Step 1: Create `apps/web/app/scout/[id]/cost/page.tsx`**

No state needed — pure display. Server component.

```tsx
import Link from "next/link";

const costData = {
  landCost: 980000,
  buildCost: 3456000,
  profFees: 414720,
  bulkContribs: 400000,
  transferDuty: 78400,
  total: 5329120,
  rentalPerUnit: 6800,
  units: 8,
  grossMonthly: 54400,
  grossAnnual: 652800,
  yield: 12.2,
  occupancy85: 11.2,
};

const fmt = (n: number) => `R${n.toLocaleString()}`;

const bars = [
  { label: "Land", value: costData.landCost, color: "bg-accent-blue" },
  { label: "Build", value: costData.buildCost, color: "bg-purple-500" },
  { label: "Prof. Fees", value: costData.profFees, color: "bg-accent-amber" },
  { label: "Bulk Levy", value: costData.bulkContribs, color: "bg-accent-red" },
  { label: "Transfer", value: costData.transferDuty, color: "bg-text-muted" },
];

const maxVal = Math.max(...bars.map((b) => b.value));

const kpis = [
  { label: "Total Investment", value: fmt(costData.total), color: "bg-accent-blue", textColor: "text-accent-blue", sub: "All-in cost" },
  { label: "Gross Annual Income", value: fmt(costData.grossAnnual), color: "bg-accent-green", textColor: "text-accent-green", sub: "100% occupied" },
  { label: "Yield @ 100%", value: `${costData.yield}%`, color: "bg-accent-green", textColor: "text-accent-green", sub: "Before expenses" },
  { label: "Yield @ 85%", value: `${costData.occupancy85}%`, color: "bg-accent-amber", textColor: "text-accent-amber", sub: "Realistic occupancy" },
];

export default function CostOraclePage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-1.5">
            Cost Oracle · ROI Analysis
          </div>
          <h1 className="font-heading text-[24px] text-text-primary font-bold">
            ERF 1247 · 8 Bachelor Units
          </h1>
          <div className="text-text-muted text-xs mt-1 font-mono">
            Build rate: R13,500/m² · 2026 Gauteng tariffs
          </div>
        </div>
        <button className="bg-accent-amber text-black rounded-lg px-5 py-2.5 text-xs font-mono font-bold hover:bg-amber-400 transition-colors">
          ↓ EXPORT PDF REPORT
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-bg-surface border border-border rounded-card p-4.5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${k.color}`} />
            <div className="text-[10px] font-mono text-text-muted tracking-[1px] uppercase mb-2">{k.label}</div>
            <div className={`font-heading text-2xl font-bold ${k.textColor}`}>{k.value}</div>
            <div className="text-[10px] font-mono text-text-dim mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Cost breakdown */}
        <div className="bg-bg-surface border border-border rounded-card p-5">
          <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-4">
            Cost Breakdown
          </div>
          <div className="flex flex-col gap-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-mono text-text-muted">{b.label}</span>
                  <span className="text-xs font-mono text-text-primary font-bold">{fmt(b.value)}</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${b.color} rounded-full`}
                    style={{ width: `${(b.value / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="text-[13px] font-mono text-text-primary font-bold">TOTAL</span>
              <span className="text-[13px] font-mono text-accent-blue font-bold">{fmt(costData.total)}</span>
            </div>
          </div>
        </div>

        {/* Income + decision */}
        <div className="flex flex-col gap-3.5">
          {/* Income projection */}
          <div className="bg-bg-surface border border-border rounded-card p-5">
            <div className="text-[11px] font-mono text-text-muted tracking-[1px] uppercase mb-3.5">
              Income Projection
            </div>
            {[
              { label: "Rent per unit", value: `R${costData.rentalPerUnit.toLocaleString()}/mo` },
              { label: "Units", value: costData.units },
              { label: "Gross monthly", value: fmt(costData.grossMonthly) },
              { label: "Gross annual", value: fmt(costData.grossAnnual) },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-xs font-mono text-text-muted">{r.label}</span>
                <span className="text-xs font-mono text-text-primary font-bold">{r.value}</span>
              </div>
            ))}
          </div>

          {/* Decision engine */}
          <div className="bg-[#0d2818] border border-green-800/30 rounded-card p-4.5">
            <div className="text-[11px] font-mono text-accent-green tracking-[1px] uppercase mb-3">
              Decision Engine
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="font-heading text-[42px] text-accent-green font-bold leading-none">✓</div>
              <div>
                <div className="text-text-primary text-sm font-mono font-bold">VIABLE INVESTMENT</div>
                <div className="text-text-muted text-[11px] font-mono mt-0.5">Score: 92/100 · LOW risk</div>
              </div>
            </div>
            <p className="text-text-muted text-xs leading-relaxed">
              12.2% yield exceeds the 10% threshold. Low dolomite risk. 8 bachelor units viable
              under Res 3 without rezoning. Bulk levies estimated at R400k — confirm with JHB.
            </p>
            <div className="flex gap-2 mt-3.5">
              <button className="flex-1 bg-accent-green text-black rounded-lg py-2.5 text-xs font-mono font-bold hover:bg-green-400 transition-colors">
                MARK ACTIVE PROJECT
              </button>
              <Link
                href={`/scout/${params.id}/zoning`}
                className="bg-white/5 border border-border text-text-muted rounded-lg px-3.5 py-2.5 text-xs font-mono hover:text-text-primary transition-colors"
              >
                FORMS →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

```bash
pnpm dev
```

Open http://localhost:3000/scout/1247/cost. Verify: 4 KPI cards with colored top borders, cost breakdown with progress bars, income projection table, green "VIABLE INVESTMENT" decision card.

**Step 3: Run final typecheck**

```bash
cd /Users/tbmkhabela/Projects/FGP
pnpm typecheck
```

Expected: No errors.

**Step 4: Commit**

```bash
git add apps/web/app/scout/
git commit -m "feat: add cost oracle page converted from mockup"
```

---

## Definition of Done

- [ ] `pnpm dev` starts Next.js on :3000 with the dark app shell visible
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok",...}` (both from host and Docker)
- [ ] `docker compose -f infra/docker-compose.yml up -d` starts all 3 services healthy
- [ ] `supabase start` + `supabase db push` applies the full schema (11 tables)
- [ ] `pnpm typecheck` passes with no errors
- [ ] `uv run ruff check .` passes in apps/worker
- [ ] All commits in (Tasks 1–9)
- [ ] `.env.example` documents all required variables
- [ ] `/dashboard` renders with KPIs, leads list, and map placeholder
- [ ] `/scout` renders with filter pills and lead cards
- [ ] `/scout/1247` renders with parcel facts, zoning rules, unit toggle
- [ ] `/scout/1247/zoning` renders with accordion forms and compliance checklist
- [ ] `/scout/1247/cost` renders with cost breakdown and decision engine

---

## Next Steps (Phase 1)

After this scaffold is complete, Phase 1 starts with:
1. GIS ingestion scripts (`scripts/seed/ingest_parcels.py` etc.)
2. `POST /analyze/parcel` endpoint in apps/worker
3. Zoning scheme rules seed data
4. `packages/database` filled with Drizzle schema
