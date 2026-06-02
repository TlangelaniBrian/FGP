# FGP Phase 1 Design — No-Shapefiles Build
**Date:** 2026-06-03  
**Status:** Approved  
**Owner:** Tlangelani Mkhabela

---

## Context

Monorepo scaffold is complete (Phase 0). GIS shapefiles (CSG parcels, municipal zoning, CGS dolomite) are not yet on disk — the geo data layer is blocked on external acquisition. This spec defines what to build now so the product is demonstrable and useful before that data arrives.

---

## Goal

Two independently usable features delivered end-to-end:

1. **Projects** — track a live build project (Soshanguve seeded from Excel data). Replaces the spreadsheet as the weekly check-in tool.
2. **Evaluate Land** — manually enter a listing (address, price, size, zone) and get a feasibility score + downloadable PDF. Lives inside the Projects flow as a pre-project step.

No map. No scrapers. No automated geo enrichment. Those come in Phase 2 once shapefiles arrive.

---

## Navigation Structure

Projects-first. The sidebar shows projects; feasibility is triggered from within a project or as a pre-project step.

```
Sidebar
├── PROJECTS
│   ├── ● Soshanguve Build        ← seeded on first run
│   └── + Evaluate land           ← entry point for new analysis
└── TOOLS
    ├── Documents
    └── Settings
```

Routes:
```
/projects                        → list of projects
/projects/[id]                   → project detail (Soshanguve)
/projects/[id]/budget            → line-item budget view
/projects/[id]/decisions         → decision log
/evaluate                        → land analysis form
/evaluate/result                  → ephemeral result stored in Zustand (client-side only, no DB row)
```

---

## Feature 1: Projects

### Project Detail Page — Section Order

All sections on one scrollable page. Top-to-bottom priority:

1. **This week** — current week's actions from the action tracker. Urgent items highlighted. "Log check-in" button.
2. **Finance strip** — 3 stat cards (Saved to date, Next milestone + date + gap, Break ground date). Mini cash flow bar chart below.
3. **Milestones timeline** — vertical timeline, each milestone shows status, date, owner, and blocking indicator.
4. **Budget** — category-level cost table (PRE-CONSTRUCTION, SITE PREP, FOUNDATIONS, etc.) with budget vs actual columns.
5. **Contacts** — key professionals (attorney, co-owner, contractor TBD).
6. **Decision log** — append-only log of project decisions with rationale.

### Soshanguve Seed Data

On first boot (or via `scripts/seed/seed_soshanguve.ts`), insert:

**Project record:**
- Name: Soshanguve Build
- ERF: 14201, Soshanguve South Ext 13
- Partners: Tlangelani Mkhabela + Inathi Mdledle
- Status: planning
- Monthly saving: R3,000 combined (R1,500 each)
- Phase 1 target: R210,000

**Budget line items** (from `Soshanguve Property Project Budget.xlsx` — Budget sheet):

| Category | Item | Qty | Unit | Unit Cost | Total | Status |
|---|---|---|---|---|---|---|
| PRE-CONSTRUCTION | Property Transfer | 1 | Lump Sum | 15,000 | 15,000 | Pending |
| PRE-CONSTRUCTION | Building Plans | 1 | Lump Sum | 10,000 | 10,000 | To quote |
| PRE-CONSTRUCTION | Municipal Fees | 1 | Lump Sum | 3,000 | 3,000 | To confirm |
| PRE-CONSTRUCTION | Site Survey | 1 | Lump Sum | 4,000 | 4,000 | To quote |
| SITE PREP | Clearing | 200 | m² | 30 | 6,000 | Estimate |
| SITE PREP | Excavation | 20 | m³ | 250 | 5,000 | Estimate |
| FOUNDATIONS | Concrete | 10 | m³ | 2,000 | 20,000 | Estimate |
| FOUNDATIONS | Blocks | 800 | each | 12 | 9,600 | Estimate |
| FOUNDATIONS | Damp proof | 60 | m | 40 | 2,400 | Estimate |
| WALLS | Bricks/Blocks | 4,000 | each | 6 | 24,000 | Estimate |
| WALLS | Cement/Sand | 5 | m³ | 800 | 4,000 | Estimate |
| ROOF | Timber | 200 | m | 80 | 16,000 | Estimate |
| ROOF | Sheeting | 80 | m² | 180 | 14,400 | Estimate |
| ROOF | Nails/Fittings | 1 | Lump Sum | 2,000 | 2,000 | Estimate |
| WINDOWS/DOORS | Windows | 4 | each | 1,500 | 6,000 | Estimate |
| WINDOWS/DOORS | Doors | 6 | each | 2,000 | 12,000 | Estimate |
| WINDOWS/DOORS | Security | 4 | each | 800 | 3,200 | Estimate |
| FLOOR | Concrete | 60 | m² | 200 | 12,000 | Estimate |
| FLOOR | Screed | 60 | m² | 50 | 3,000 | Estimate |
| PLASTER | Internal | 240 | m² | 60 | 14,400 | Estimate |
| PLASTER | External | 120 | m² | 70 | 8,400 | Estimate |
| PAINT | Paint | 80 | Litre | 120 | 9,600 | Estimate |
| ELECTRICAL | Wiring | 2 | Room | 5,000 | 10,000 | Estimate |
| ELECTRICAL | Fittings | 1 | Lump Sum | 3,000 | 3,000 | Estimate |
| PLUMBING | Basic plumbing | 2 | Room | 8,000 | 16,000 | Estimate |
| PLUMBING | Sanitary | 2 | Room | 5,000 | 10,000 | Estimate |
| EXTERNAL | Boundary | 50 | m | 200 | 10,000 | Estimate |
| EXTERNAL | Gate | 1 | Set | 5,000 | 5,000 | Estimate |
| LABOUR | Skilled labour | 40 | Days | 500 | 20,000 | Estimate |
| LABOUR | General labour | 60 | Days | 300 | 18,000 | Estimate |
| CONTINGENCY | Unforeseen | — | 10% | — | 27,900 | Reserve |

Phase 1 total: **R306,900**

**Cash flow** (from `Soshanguve_Funding_Tracker_v2.xlsx` — Cash Flow sheet):
- Base case: R1,500/person/month from May 2026
- Monthly spend events as modelled in the spreadsheet
- Scenarios: Base case + R20k lump sum (flagged as unconfirmed)

**Milestones** (from Milestones sheet):

| Date | Milestone | Status | Owner |
|---|---|---|---|
| Apr–May 2026 | Property transfer registers | IN PROGRESS | Tlangelani |
| May 2026 | Open joint savings — first R3,000 deposited | IN PROGRESS | Both |
| Mar 2027 | ★ Paperwork funded (~R30k) | PENDING | Tlangelani |
| Apr 2028 | ★ Loan-ready (~R39k balance) | PENDING | Tlangelani |
| Mid 2028 | Apply for building loan (R150–180k) | PENDING | Tlangelani |
| Oct 2028 | ★ BREAK GROUND | PENDING | Inathi |
| End 2029 | ★ Phase 1 complete — rentable | PENDING | Both |

**Contacts:**

| Role | Name | Contact | Status |
|---|---|---|---|
| Conveyancing Attorney | Andrew Thomas Attorneys — Cassius Chauke | 017 054 0005 / deeds@andrewthomas.co.za | Active |
| Co-Owner | Inathi Mdledle | inathimdledle@gmail.com | Active |
| Architect | TO BE HIRED | — | Pending |
| Contractor | TO BE HIRED | — | Pending |

**Decision log** (from Decision Log sheet):

| Date | Decision | Rationale |
|---|---|---|
| Apr 2026 | Minimum Viable Shell strategy — Phase 1 = watertight shell only | Full-time jobs; smaller scope = faster, less contractor risk |
| Apr 2026 | Monthly contribution R1,500 each (R3,000 combined) | Realistic disposable income; leaves headroom |
| Apr 2026 | Save-then-borrow strategy | Cash-only takes 70 months; borrow R150–180k against titled asset in 2028 |
| Apr 2026 | R20k lump sum treated as UNCONFIRMED | Unconfirmed lump sums that enter base plan become crises |
| Apr 2026 | Groundbreaking target: Oct 2028 (base case) | 18–24 months savings + 6 months loan process |

### Weekly Check-In

- "Log check-in" button opens a modal with the weekly template fields: Attorney status, Savings confirmed, Supplier/quote progress, Open issues, Actions before next call, Decisions needed.
- Submissions stored in `project_checkins` table.
- Current week's uncompleted action items surface at the top of the project page.

### Data Model Additions

New tables needed (extend `0001_initial.sql` in a new migration):

```sql
CREATE TABLE project_checkins (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id),
  week_of       DATE NOT NULL,
  attorney_status     TEXT,
  savings_confirmed   BOOLEAN,
  supplier_progress   TEXT,
  open_issues         TEXT,
  actions_next_call   TEXT,
  decisions_needed    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_budget_items (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id),
  category      TEXT NOT NULL,
  item          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT,
  quantity      NUMERIC,
  unit_cost     NUMERIC,
  total_cost    NUMERIC,  -- nullable; computed at insert (qty * unit_cost), or set manually for % items like contingency
  actual_cost   NUMERIC,
  status        TEXT DEFAULT 'estimate' CHECK (status IN ('estimate', 'quoted', 'approved', 'paid')),
  timeline      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_contacts (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id),
  role          TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  notes         TEXT
);

CREATE TABLE project_decisions (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id),
  decided_at    DATE NOT NULL,
  decision      TEXT NOT NULL,
  rationale     TEXT,
  impact        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add savings_config and cash_flow to projects table
ALTER TABLE projects ADD COLUMN erf_number TEXT;
ALTER TABLE projects ADD COLUMN township TEXT;
ALTER TABLE projects ADD COLUMN partners TEXT[];
ALTER TABLE projects ADD COLUMN monthly_saving_zar NUMERIC;
ALTER TABLE projects ADD COLUMN phase1_target_zar NUMERIC;
ALTER TABLE projects ADD COLUMN scenario TEXT DEFAULT 'base' CHECK (scenario IN ('base', 'lump_sum'));
```

---

## Feature 2: Evaluate Land

### Flow

```
/evaluate
  └─ Form: address, price (ZAR), size (m²), municipality, zone code
       └─ Submit → POST /api/feasibility (Next.js API route)
            └─ Worker: calculate_feasibility()
                 └─ Result page (ephemeral)
                      ├─ Score card (0–100, viable yes/no)
                      ├─ Cost breakdown
                      ├─ Yield projection
                      └─ [Keep this analysis] button → saves to DB + links to project
```

### Form Fields

| Field | Type | Validation |
|---|---|---|
| Address | text | required |
| Municipality | select | johannesburg / tshwane / ekurhuleni |
| Zone code | select | RES1/RES2/RES3/RES4/COM1 (filtered by municipality) |
| Size (m²) | number | 100–50,000 |
| Price (ZAR) | number | 10,000–500,000,000 |
| Unit type | select | bachelor / 1bed / 2bed |
| Target units | number | 1–200 |

Zoning rules are looked up from `zoning_scheme_rules` table using municipality + zone code. If no real data exists, use the hardcoded defaults from CLAUDE.md Section 8.

### Calculation Engine (FastAPI `/analyze/feasibility`)

Implements the logic from CLAUDE.md Section 8 verbatim:
- `BUILD_RATES_2026`, `UNIT_SIZES`
- `calculate_transfer_duty()` — SARS 2026 brackets
- `calculate_bulk_contributions()` — municipality tariffs
- Viability threshold: yield at 85% occupancy ≥ 10%

No geo enrichment in this phase. Dolomite risk = UNKNOWN. Amenity scores = null.

### Result Storage

- Default: ephemeral — result shown but not saved.
- "Keep this analysis" button: saves `feasibility_reports` row + creates/links a `listings` row. User can optionally attach it to an existing project.

---

## Security & Infrastructure Requirements

These are not optional features — they are implementation constraints:

| Requirement | Implementation |
|---|---|
| Auth | Supabase Auth JWT on all API routes. Every DB query filters by `user_id`. RLS policies on all tables. |
| SQL injection | All PostGIS and Drizzle queries use parameterised inputs. No f-string SQL. |
| WeasyPrint sanitisation | Jinja2 `autoescape=True` on all PDF templates. Strip user HTML before render. |
| Rate limiting | `slowapi` on FastAPI — 10 req/min per IP on `/analyze/feasibility`. |
| Input bounds | Reject `size_sqm > 1_000_000` or `price > 500_000_000` at Pydantic layer. |
| S3 PDF URLs | Pre-signed URLs (1hr expiry) — never public permanent links. PDFs contain PII. |
| Secrets | All credentials in `.env` only. `SUPABASE_SERVICE_ROLE_KEY` never in client bundle. |

---

## What Is Explicitly Out of Scope

- MapLibre map component (needs shapefiles)
- GIS seed scripts (needs shapefiles)
- `/analyze/parcel` geo endpoint (needs PostGIS data)
- Playwright scrapers
- Three.js massing component
- WhatsApp notifications
- Multi-user / team features
- CI/CD pipeline (defer to after first working feature)

---

## Phased Delivery Within This Spec

### Chunk 1 — Data layer (DB migrations + seed)
- Migration `0002_projects_extended.sql` — new tables above
- `scripts/seed/seed_soshanguve.ts` — insert all Soshanguve data
- Drizzle schema in `packages/database` reflecting all tables
- Zoning scheme rules seeded for JHB + Tshwane RES1–RES4

### Chunk 2 — Worker: feasibility calculation
- `apps/worker/routers/feasibility.py` — POST `/analyze/feasibility`
- Pydantic models, calculation engine, rate limiter
- Unit tests for transfer duty + BSC calculations

### Chunk 3 — Web: Evaluate Land
- `/evaluate` form page
- `/evaluate/result/[id]` result page (ephemeral)
- "Keep this analysis" save flow
- Calls worker via `WORKER_URL` env var

### Chunk 4 — Web: Projects + Soshanguve detail
- `/projects` list page
- `/projects/[id]` detail page — all sections in order: This week → Finance → Timeline → Budget → Contacts → Decisions
- Weekly check-in modal
- Sidebar navigation

### Chunk 5 — PDF generation
- WeasyPrint templates: `motivation_letter.html`, `building_plan_checklist.html`
- `apps/worker/routers/forms.py` — POST `/forms/generate`
- S3 upload + pre-signed URL return
- PDF preview in browser (react-pdf)

---

## Success Criteria

1. Can enter a land listing manually and get a feasibility score with cost breakdown in under 10 seconds.
2. Can open the Soshanguve project page and see this week's actions, current balance, and next milestone without opening a spreadsheet.
3. Can log a weekly check-in from the app.
4. Can generate and download a motivation letter PDF for a feasibility result.
5. All DB queries parameterised. Rate limiting active on analysis endpoint.
