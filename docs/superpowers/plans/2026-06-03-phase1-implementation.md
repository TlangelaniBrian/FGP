# Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Projects tracker (Soshanguve seeded) + Evaluate Land feasibility form end-to-end, no map, no scrapers.

**Architecture:** Projects-first nav with sidebar; feasibility calculation in FastAPI worker called from Next.js API route; ephemeral results in Zustand, saved on explicit "Keep" action; Supabase Postgres for all persistence.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Zustand, React Hook Form + Zod, FastAPI Python 3.12, Pydantic v2, psycopg3, slowapi, Supabase/Drizzle ORM, pnpm workspaces.

---

## File Map

```
supabase/migrations/
  0002_projects_extended.sql       ← new tables + ALTER projects

packages/database/
  schema.ts                        ← Drizzle schema (all tables)
  client.ts                        ← server-side Drizzle client
  index.ts                         ← re-exports

scripts/seed/
  seed_soshanguve.ts               ← inserts Soshanguve project + all sub-data
  seed_zoning_rules.ts             ← seeds RES1-RES4 JHB+Tshwane defaults

apps/worker/
  routers/
    feasibility.py                 ← POST /analyze/feasibility
  services/
    calculations.py                ← transfer duty, BSC, yield engine
  tests/
    test_calculations.py           ← unit tests for all financial functions
  main.py                          ← register feasibility router + slowapi

apps/web/
  app/
    layout.tsx                     ← update nav: sidebar shell
    projects/
      page.tsx                     ← projects list
      [id]/
        page.tsx                   ← project detail (all sections)
        _components/
          ThisWeek.tsx
          FinanceStrip.tsx
          MilestonesTimeline.tsx
          BudgetTable.tsx
          ContactsTable.tsx
          DecisionLog.tsx
          CheckInModal.tsx
    evaluate/
      page.tsx                     ← land analysis form
      result/
        page.tsx                   ← ephemeral result display
  lib/
    supabase-server.ts             ← server-side Supabase client (service role)
    feasibility-store.ts           ← Zustand store for ephemeral result
  app/api/
    feasibility/route.ts           ← POST: proxies to worker, returns result
    feasibility/save/route.ts      ← POST: saves report + listing to DB
    projects/route.ts              ← GET: list projects
    projects/[id]/route.ts         ← GET: single project with all relations
    projects/[id]/checkins/route.ts ← POST: save weekly check-in
```

---

## Task 1: DB Migration — New Tables

**Files:**
- Create: `supabase/migrations/0002_projects_extended.sql`

- [ ] **Write the migration**

```sql
-- supabase/migrations/0002_projects_extended.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS erf_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS township TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS partners TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_saving_zar NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS phase1_target_zar NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scenario TEXT DEFAULT 'base'
  CHECK (scenario IN ('base', 'lump_sum'));

CREATE TABLE IF NOT EXISTS project_budget_items (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  item          TEXT NOT NULL,
  description   TEXT,
  unit          TEXT,
  quantity      NUMERIC,
  unit_cost     NUMERIC,
  total_cost    NUMERIC,
  actual_cost   NUMERIC,
  status        TEXT DEFAULT 'estimate'
    CHECK (status IN ('estimate', 'quoted', 'approved', 'paid')),
  timeline      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_contacts (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  status        TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inactive')),
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS project_decisions (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  decided_at    DATE NOT NULL,
  decision      TEXT NOT NULL,
  rationale     TEXT,
  impact        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_checkins (
  id                  BIGSERIAL PRIMARY KEY,
  project_id          BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  week_of             DATE NOT NULL,
  attorney_status     TEXT,
  savings_confirmed   BOOLEAN,
  supplier_progress   TEXT,
  open_issues         TEXT,
  actions_next_call   TEXT,
  decisions_needed    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: all project-related tables locked to owner
ALTER TABLE project_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON project_budget_items
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_contacts
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_decisions
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "owner_only" ON project_checkins
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Zoning scheme rules (no RLS — public reference data)
CREATE TABLE IF NOT EXISTS zoning_scheme_rules (
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
```

- [ ] **Apply migration to local Supabase**

```bash
# From project root — requires supabase CLI and local instance running
supabase db push
```

Expected: `Applied migration 0002_projects_extended`

- [ ] **Commit**

```bash
git add supabase/migrations/0002_projects_extended.sql
git commit -m "feat(db): add project sub-tables, RLS policies, zoning_scheme_rules"
```

---

## Task 2: Drizzle Schema

**Files:**
- Modify: `packages/database/schema.ts`
- Modify: `packages/database/client.ts`
- Modify: `packages/database/index.ts`

- [ ] **Install Drizzle dependencies**

```bash
cd packages/database
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
```

- [ ] **Write schema.ts**

```typescript
// packages/database/schema.ts
import {
  pgTable, bigserial, text, numeric, integer, boolean,
  timestamp, date, serial, check,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id"),
  listingId: bigserial("listing_id", { mode: "number" }),
  reportId: bigserial("report_id", { mode: "number" }),
  name: text("name"),
  status: text("status").default("planning"),
  notes: text("notes"),
  erfNumber: text("erf_number"),
  township: text("township"),
  partners: text("partners").array(),
  monthlySavingZar: numeric("monthly_saving_zar"),
  phase1TargetZar: numeric("phase1_target_zar"),
  scenario: text("scenario").default("base"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectBudgetItems = pgTable("project_budget_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  category: text("category").notNull(),
  item: text("item").notNull(),
  description: text("description"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  actualCost: numeric("actual_cost"),
  status: text("status").default("estimate"),
  timeline: text("timeline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectContacts = pgTable("project_contacts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  role: text("role").notNull(),
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").default("pending"),
  notes: text("notes"),
});

export const projectDecisions = pgTable("project_decisions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  decidedAt: date("decided_at").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale"),
  impact: text("impact"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectCheckins = pgTable("project_checkins", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  weekOf: date("week_of").notNull(),
  attorneyStatus: text("attorney_status"),
  savingsConfirmed: boolean("savings_confirmed"),
  supplierProgress: text("supplier_progress"),
  openIssues: text("open_issues"),
  actionsNextCall: text("actions_next_call"),
  decisionsNeeded: text("decisions_needed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const zoningSchemeRules = pgTable("zoning_scheme_rules", {
  id: serial("id").primaryKey(),
  municipality: text("municipality").notNull(),
  zoneCode: text("zone_code").notNull(),
  zoneLabel: text("zone_label"),
  maxUnitsPerHa: integer("max_units_per_ha"),
  maxUnitsPerErf: integer("max_units_per_erf"),
  coveragePct: numeric("coverage_pct"),
  far: numeric("far"),
  maxHeightM: numeric("max_height_m"),
  maxStoreys: integer("max_storeys"),
  buildingLineFrontM: numeric("building_line_front_m"),
  buildingLineSideM: numeric("building_line_side_m"),
  buildingLineRearM: numeric("building_line_rear_m"),
  permittedUses: text("permitted_uses").array(),
  consentUses: text("consent_uses").array(),
  rezoningPossibleTo: text("rezoning_possible_to").array(),
  rezoningDifficulty: text("rezoning_difficulty"),
  rezoningApprovalRate: numeric("rezoning_approval_rate"),
  formsRequired: text("forms_required").array(),
  schemeDocument: text("scheme_document"),
  schemeYear: integer("scheme_year"),
  lastUpdated: date("last_updated"),
});

export const feasibilityReports = pgTable("feasibility_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  listingId: bigserial("listing_id", { mode: "number" }).notNull(),
  userId: text("user_id"),
  unitType: text("unit_type").notNull(),
  targetUnits: integer("target_units").notNull(),
  buildRatePerSqm: numeric("build_rate_per_sqm").notNull().default("13500"),
  tariffYear: integer("tariff_year").notNull().default(2026),
  maxUnitsAllowed: integer("max_units_allowed"),
  maxBuildableSqm: numeric("max_buildable_sqm"),
  maxFootprintSqm: numeric("max_footprint_sqm"),
  rezoningRequired: boolean("rezoning_required").default(false),
  costLand: numeric("cost_land"),
  costBuild: numeric("cost_build"),
  costProfessionalFees: numeric("cost_professional_fees"),
  costBulkContributions: numeric("cost_bulk_contributions"),
  costTransferDuty: numeric("cost_transfer_duty"),
  costTotal: numeric("cost_total"),
  rentPerUnitMonthly: numeric("rent_per_unit_monthly"),
  grossMonthlyIncome: numeric("gross_monthly_income"),
  grossAnnualIncome: numeric("gross_annual_income"),
  yieldGrossPct: numeric("yield_gross_pct"),
  yieldAt85OccPct: numeric("yield_at_85_occ_pct"),
  viable: boolean("viable"),
  viabilityNotes: text("viability_notes"),
  pdfPackageUrl: text("pdf_package_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const listings = pgTable("listings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id"),
  sourceUrl: text("source_url"),
  address: text("address"),
  suburb: text("suburb"),
  city: text("city"),
  municipality: text("municipality"),
  sizeSqm: numeric("size_sqm"),
  price: numeric("price"),
  listingType: text("listing_type").default("vacant_land"),
  description: text("description"),
  zoneCode: text("zone_code"),
  dolomiteRisk: text("dolomite_risk"),
  status: text("status").default("new"),
  feasibilityScore: integer("feasibility_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: bigserial("project_id", { mode: "number" }).notNull(),
  targetDate: text("target_date").notNull(),
  milestone: text("milestone").notNull(),
  status: text("status").default("PENDING"),
  owner: text("owner"),
  isMajor: boolean("is_major").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
```

- [ ] **Write client.ts**

```typescript
// packages/database/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const sql = postgres(connectionString, { max: 1 });
export const db = drizzle(sql, { schema });
export type DB = typeof db;
```

- [ ] **Write index.ts**

```typescript
// packages/database/index.ts
export { db } from "./client";
export * from "./schema";
```

- [ ] **Add milestones table to migration** (add to bottom of 0002)

```sql
-- append to supabase/migrations/0002_projects_extended.sql
CREATE TABLE IF NOT EXISTS milestones (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  target_date TEXT NOT NULL,
  milestone   TEXT NOT NULL,
  status      TEXT DEFAULT 'PENDING',
  owner       TEXT,
  is_major    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON milestones
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
```

- [ ] **Re-push migration**

```bash
supabase db push
```

- [ ] **Commit**

```bash
git add packages/database/ supabase/migrations/0002_projects_extended.sql
git commit -m "feat(db): Drizzle schema covering all Phase 1 tables"
```

---

## Task 3: Seed Zoning Rules

**Files:**
- Create: `scripts/seed/seed_zoning_rules.ts`

- [ ] **Write seed_zoning_rules.ts**

```typescript
// scripts/seed/seed_zoning_rules.ts
import { db, zoningSchemeRules } from "@fgp/database";

const rules = [
  // JHB
  { municipality: "johannesburg", zoneCode: "RES1", zoneLabel: "Residential 1", maxUnitsPerErf: 1, coveragePct: "40", far: "0.5", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["single_dwelling"] },
  { municipality: "johannesburg", zoneCode: "RES2", zoneLabel: "Residential 2", maxUnitsPerErf: 2, coveragePct: "50", far: "0.75", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["dwelling_units", "second_dwelling"] },
  { municipality: "johannesburg", zoneCode: "RES3", zoneLabel: "Residential 3", maxUnitsPerHa: 80, coveragePct: "60", far: "1.5", maxStoreys: 3, buildingLineFrontM: "3", buildingLineSideM: "1.5", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  { municipality: "johannesburg", zoneCode: "RES4", zoneLabel: "Residential 4", maxUnitsPerHa: 120, coveragePct: "70", far: "2.5", maxStoreys: 4, buildingLineFrontM: "2", buildingLineSideM: "1", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  // Tshwane
  { municipality: "tshwane", zoneCode: "RES1", zoneLabel: "Residential 1", maxUnitsPerErf: 1, coveragePct: "40", far: "0.4", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["single_dwelling"] },
  { municipality: "tshwane", zoneCode: "RES2", zoneLabel: "Residential 2", maxUnitsPerErf: 2, coveragePct: "50", far: "0.6", maxStoreys: 2, buildingLineFrontM: "4.5", buildingLineSideM: "1.5", buildingLineRearM: "3", permittedUses: ["dwelling_units"] },
  { municipality: "tshwane", zoneCode: "RES3", zoneLabel: "Residential 3", maxUnitsPerHa: 60, coveragePct: "55", far: "1.2", maxStoreys: 3, buildingLineFrontM: "3", buildingLineSideM: "1.5", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
  { municipality: "tshwane", zoneCode: "RES4", zoneLabel: "Residential 4", maxUnitsPerHa: 100, coveragePct: "65", far: "2.0", maxStoreys: 4, buildingLineFrontM: "2", buildingLineSideM: "1", buildingLineRearM: "2", permittedUses: ["flats", "dwelling_units"] },
];

async function main() {
  await db.insert(zoningSchemeRules).values(rules).onConflictDoNothing();
  console.log(`Seeded ${rules.length} zoning scheme rules`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Add script to root package.json**

```json
"scripts": {
  "seed:zoning": "tsx scripts/seed/seed_zoning_rules.ts",
  "seed:soshanguve": "tsx scripts/seed/seed_soshanguve.ts"
}
```

- [ ] **Install tsx**

```bash
pnpm add -D tsx -w
```

- [ ] **Run it**

```bash
pnpm seed:zoning
```

Expected: `Seeded 8 zoning scheme rules`

- [ ] **Commit**

```bash
git add scripts/seed/seed_zoning_rules.ts package.json pnpm-lock.yaml
git commit -m "feat(seed): zoning scheme rules for JHB + Tshwane RES1-RES4"
```

---

## Task 4: Seed Soshanguve Project

**Files:**
- Create: `scripts/seed/seed_soshanguve.ts`

- [ ] **Write seed_soshanguve.ts**

```typescript
// scripts/seed/seed_soshanguve.ts
import { db, projects, projectBudgetItems, projectContacts, projectDecisions, milestones } from "@fgp/database";

async function main() {
  const [project] = await db.insert(projects).values({
    name: "Soshanguve Build",
    status: "planning",
    erfNumber: "14201",
    township: "Soshanguve South Extension 13",
    partners: ["Tlangelani Mkhabela", "Inathi Mdledle"],
    monthlySavingZar: "3000",
    phase1TargetZar: "210000",
    scenario: "base",
    notes: "ERF 14201, Soshanguve South Ext 13. Save-then-borrow strategy. Break ground Oct 2028.",
  }).returning();

  const pid = project.id;

  await db.insert(projectBudgetItems).values([
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Property Transfer",  unit: "Lump Sum", quantity: "1", unitCost: "15000", totalCost: "15000",  status: "estimate", timeline: "Apr-May 2026", notes: "Andrew Thomas estimate" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Building Plans",     unit: "Lump Sum", quantity: "1", unitCost: "10000", totalCost: "10000",  status: "estimate", timeline: "May-Jun 2026", notes: "Local draughtsman" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Municipal Fees",     unit: "Lump Sum", quantity: "1", unitCost: "3000",  totalCost: "3000",   status: "estimate", timeline: "Jun-Jul 2026", notes: "Soshanguve municipality" },
    { projectId: pid, category: "PRE-CONSTRUCTION", item: "Site Survey",        unit: "Lump Sum", quantity: "1", unitCost: "4000",  totalCost: "4000",   status: "estimate" },
    { projectId: pid, category: "SITE PREP",        item: "Clearing",           unit: "m²",       quantity: "200", unitCost: "30",  totalCost: "6000",   status: "estimate" },
    { projectId: pid, category: "SITE PREP",        item: "Excavation",         unit: "m³",       quantity: "20",  unitCost: "250", totalCost: "5000",   status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Concrete",           unit: "m³",       quantity: "10",  unitCost: "2000",totalCost: "20000",  status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Blocks",             unit: "each",     quantity: "800", unitCost: "12",  totalCost: "9600",   status: "estimate" },
    { projectId: pid, category: "FOUNDATIONS",      item: "Damp proof",         unit: "m",        quantity: "60",  unitCost: "40",  totalCost: "2400",   status: "estimate" },
    { projectId: pid, category: "WALLS",            item: "Bricks/Blocks",      unit: "each",     quantity: "4000",unitCost: "6",   totalCost: "24000",  status: "estimate" },
    { projectId: pid, category: "WALLS",            item: "Cement/Sand",        unit: "m³",       quantity: "5",   unitCost: "800", totalCost: "4000",   status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Timber",             unit: "m",        quantity: "200", unitCost: "80",  totalCost: "16000",  status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Sheeting",           unit: "m²",       quantity: "80",  unitCost: "180", totalCost: "14400",  status: "estimate" },
    { projectId: pid, category: "ROOF",             item: "Nails/Fittings",     unit: "Lump Sum", quantity: "1",   unitCost: "2000",totalCost: "2000",   status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Windows",            unit: "each",     quantity: "4",   unitCost: "1500",totalCost: "6000",   status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Doors",              unit: "each",     quantity: "6",   unitCost: "2000",totalCost: "12000",  status: "estimate" },
    { projectId: pid, category: "WINDOWS/DOORS",    item: "Security",           unit: "each",     quantity: "4",   unitCost: "800", totalCost: "3200",   status: "estimate" },
    { projectId: pid, category: "FLOOR",            item: "Concrete",           unit: "m²",       quantity: "60",  unitCost: "200", totalCost: "12000",  status: "estimate" },
    { projectId: pid, category: "FLOOR",            item: "Screed",             unit: "m²",       quantity: "60",  unitCost: "50",  totalCost: "3000",   status: "estimate" },
    { projectId: pid, category: "PLASTER",          item: "Internal",           unit: "m²",       quantity: "240", unitCost: "60",  totalCost: "14400",  status: "estimate" },
    { projectId: pid, category: "PLASTER",          item: "External",           unit: "m²",       quantity: "120", unitCost: "70",  totalCost: "8400",   status: "estimate" },
    { projectId: pid, category: "PAINT",            item: "Paint",              unit: "Litre",    quantity: "80",  unitCost: "120", totalCost: "9600",   status: "estimate" },
    { projectId: pid, category: "ELECTRICAL",       item: "Wiring",             unit: "Room",     quantity: "2",   unitCost: "5000",totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "ELECTRICAL",       item: "Fittings",           unit: "Lump Sum", quantity: "1",   unitCost: "3000",totalCost: "3000",   status: "estimate" },
    { projectId: pid, category: "PLUMBING",         item: "Basic plumbing",     unit: "Room",     quantity: "2",   unitCost: "8000",totalCost: "16000",  status: "estimate" },
    { projectId: pid, category: "PLUMBING",         item: "Sanitary",           unit: "Room",     quantity: "2",   unitCost: "5000",totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "EXTERNAL",         item: "Boundary",           unit: "m",        quantity: "50",  unitCost: "200", totalCost: "10000",  status: "estimate" },
    { projectId: pid, category: "EXTERNAL",         item: "Gate",               unit: "Set",      quantity: "1",   unitCost: "5000",totalCost: "5000",   status: "estimate" },
    { projectId: pid, category: "LABOUR",           item: "Skilled labour",     unit: "Days",     quantity: "40",  unitCost: "500", totalCost: "20000",  status: "estimate" },
    { projectId: pid, category: "LABOUR",           item: "General labour",     unit: "Days",     quantity: "60",  unitCost: "300", totalCost: "18000",  status: "estimate" },
    { projectId: pid, category: "CONTINGENCY",      item: "Unforeseen",         unit: "10%",      totalCost: "27900", status: "estimate", notes: "10% of R279,000" },
  ]);

  await db.insert(projectContacts).values([
    { projectId: pid, role: "Conveyancing Attorney", name: "Andrew Thomas Attorneys — Cassius Chauke", phone: "017 054 0005", email: "deeds@andrewthomas.co.za", status: "active" },
    { projectId: pid, role: "Co-Owner", name: "Inathi Mdledle", email: "inathimdledle@gmail.com", status: "active" },
    { projectId: pid, role: "Architect/Draughtsman", status: "pending", notes: "Need local Soshanguve/Gauteng based" },
    { projectId: pid, role: "Contractor", status: "pending", notes: "Get 3 quotes, check CIDB rating" },
  ]);

  await db.insert(projectDecisions).values([
    { projectId: pid, decidedAt: "2026-04-01", decision: "Minimum Viable Shell strategy — Phase 1 = watertight shell only", rationale: "Both have full-time jobs; smaller scope = faster completion and less contractor risk" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Monthly contribution set at R1,500 each (R3,000 combined)", rationale: "Reflects realistic disposable income; leaves headroom for personal obligations" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Save-then-borrow strategy adopted", rationale: "At R3k/mo cash-only, Phase 1 takes 70 months. Borrow R150–180k against titled asset in 2028." },
    { projectId: pid, decidedAt: "2026-04-01", decision: "R20k lump sum (Inathi) treated as UNCONFIRMED — not in base plan", rationale: "Unconfirmed lump sums that enter base plan become crises when they don't arrive" },
    { projectId: pid, decidedAt: "2026-04-01", decision: "Groundbreaking target: Oct 2028 (base case)", rationale: "18–24 months savings for paperwork + 6 months loan process" },
  ]);

  await db.insert(milestones).values([
    { projectId: pid, targetDate: "2026-05-01", milestone: "Property transfer registers via Andrew Thomas Attorneys", status: "IN_PROGRESS", owner: "Tlangelani", isMajor: false },
    { projectId: pid, targetDate: "2026-05-01", milestone: "Open joint savings account — first R3,000 deposited", status: "IN_PROGRESS", owner: "Both", isMajor: false },
    { projectId: pid, targetDate: "2027-03-01", milestone: "★ Paperwork fully funded (~R30k spent). Plans approved.", status: "PENDING", owner: "Tlangelani", isMajor: true },
    { projectId: pid, targetDate: "2028-04-01", milestone: "★ Loan-ready — ~R39k balance, titled property, approved plans", status: "PENDING", owner: "Tlangelani", isMajor: true },
    { projectId: pid, targetDate: "2028-05-01", milestone: "Apply for building loan (R150–180k) — NHFC or commercial bank", status: "PENDING", owner: "Tlangelani", isMajor: false },
    { projectId: pid, targetDate: "2028-10-01", milestone: "★ BREAK GROUND — Phase 1a begins (watertight shell, R120k)", status: "PENDING", owner: "Inathi", isMajor: true },
    { projectId: pid, targetDate: "2029-09-01", milestone: "★ Phase 1 COMPLETE — unit rentable. First rental income.", status: "PENDING", owner: "Both", isMajor: true },
  ]);

  console.log(`Seeded Soshanguve project (id=${pid})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Run it**

```bash
pnpm seed:soshanguve
```

Expected: `Seeded Soshanguve project (id=1)`

- [ ] **Commit**

```bash
git add scripts/seed/seed_soshanguve.ts
git commit -m "feat(seed): Soshanguve project — budget, contacts, decisions, milestones"
```

---

## Task 5: FastAPI Calculation Engine

**Files:**
- Create: `apps/worker/services/calculations.py`
- Create: `apps/worker/tests/test_calculations.py`

- [ ] **Write tests first**

```python
# apps/worker/tests/test_calculations.py
import pytest
from services.calculations import (
    calculate_transfer_duty,
    calculate_bulk_contributions,
    calculate_feasibility_score,
    BUILD_RATES_2026,
    UNIT_SIZES,
)


def test_transfer_duty_below_threshold():
    assert calculate_transfer_duty(1_000_000) == 0.0


def test_transfer_duty_first_bracket():
    # R1,100,001 — first rand above threshold
    duty = calculate_transfer_duty(1_100_001)
    assert duty == pytest.approx(0.03, rel=0.01)


def test_transfer_duty_second_bracket():
    # R2,000,000 → (2_000_000 - 1_512_500) * 0.06 + 12_375
    expected = (2_000_000 - 1_512_500) * 0.06 + 12_375
    assert calculate_transfer_duty(2_000_000) == pytest.approx(expected, rel=0.001)


def test_bulk_contributions_jhb():
    result = calculate_bulk_contributions("johannesburg", "bachelor", 10, 2026)
    assert 450_000 <= result <= 650_000  # R45k-R65k per unit * 10


def test_bulk_contributions_tshwane():
    result = calculate_bulk_contributions("tshwane", "1bed", 5, 2026)
    assert 190_000 <= result <= 275_000  # R38k-R55k per unit * 5


def test_feasibility_score_viable():
    result = calculate_feasibility_score(
        land_price=980_000,
        size_sqm=1024,
        unit_type="bachelor",
        target_units=8,
        municipality="johannesburg",
        zone_rules={"coverage_pct": 60, "far": 1.5, "max_storeys": 3,
                    "max_units_per_erf": None, "max_units_per_ha": 80},
    )
    assert result["viable"] is True
    assert 0 <= result["score"] <= 100
    assert result["yield_at_85_occ_pct"] > 0


def test_feasibility_score_not_viable_overpriced():
    result = calculate_feasibility_score(
        land_price=50_000_000,
        size_sqm=500,
        unit_type="bachelor",
        target_units=2,
        municipality="johannesburg",
        zone_rules={"coverage_pct": 40, "far": 0.5, "max_storeys": 2,
                    "max_units_per_erf": 1, "max_units_per_ha": None},
    )
    assert result["viable"] is False


def test_input_bounds_rejected():
    with pytest.raises(ValueError, match="size_sqm"):
        calculate_feasibility_score(
            land_price=500_000,
            size_sqm=2_000_000,  # over limit
            unit_type="bachelor",
            target_units=1,
            municipality="johannesburg",
            zone_rules={},
        )
```

- [ ] **Run tests — verify they fail**

```bash
cd apps/worker && uv run pytest tests/test_calculations.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — no implementation yet.

- [ ] **Write calculations.py**

```python
# apps/worker/services/calculations.py
from __future__ import annotations
from typing import Any

BUILD_RATES_2026: dict[str, int] = {
    "bachelor": 13_500,
    "1bed": 14_200,
    "2bed": 15_000,
    "luxury": 18_500,
}

UNIT_SIZES: dict[str, int] = {
    "bachelor": 35,
    "1bed": 55,
    "2bed": 85,
}

MARKET_RENT_2026: dict[str, dict[str, int]] = {
    "bachelor": {"default": 4_500},
    "1bed":     {"default": 6_500},
    "2bed":     {"default": 9_500},
}

BULK_RATES_2026: dict[str, dict[str, tuple[int, int]]] = {
    "johannesburg":  {"bachelor": (45_000, 65_000), "1bed": (50_000, 65_000), "2bed": (55_000, 65_000)},
    "tshwane":       {"bachelor": (38_000, 55_000), "1bed": (42_000, 55_000), "2bed": (46_000, 55_000)},
    "ekurhuleni":    {"bachelor": (40_000, 58_000), "1bed": (44_000, 58_000), "2bed": (48_000, 58_000)},
}

TRANSFER_DUTY_BRACKETS_2026 = [
    (1_100_000,  0.00, 0),
    (1_512_500,  0.03, 0),
    (2_117_500,  0.06, 12_375),
    (2_722_500,  0.08, 49_125),
    (12_100_000, 0.11, 97_125),
    (float("inf"), 0.13, 1_128_600),
]


def calculate_transfer_duty(price: float, year: int = 2026) -> float:
    if price <= 1_100_000:
        return 0.0
    for i, (threshold, rate, base) in enumerate(TRANSFER_DUTY_BRACKETS_2026[1:], 1):
        prev_threshold = TRANSFER_DUTY_BRACKETS_2026[i - 1][0]
        if price <= threshold:
            return base + (price - prev_threshold) * rate
    return 0.0


def calculate_bulk_contributions(
    municipality: str, unit_type: str, units: int, year: int = 2026
) -> float:
    rates = BULK_RATES_2026.get(municipality, BULK_RATES_2026["johannesburg"])
    lo, hi = rates.get(unit_type, rates["bachelor"])
    mid = (lo + hi) / 2
    return mid * units


def calculate_feasibility_score(
    land_price: float,
    size_sqm: float,
    unit_type: str,
    target_units: int,
    municipality: str,
    zone_rules: dict[str, Any],
    tariff_year: int = 2026,
) -> dict[str, Any]:
    if size_sqm > 1_000_000:
        raise ValueError("size_sqm exceeds maximum allowed value of 1,000,000")
    if land_price > 500_000_000:
        raise ValueError("price exceeds maximum allowed value of 500,000,000")

    unit_sqm = UNIT_SIZES.get(unit_type, 35)
    build_rate = BUILD_RATES_2026.get(unit_type, 13_500)

    coverage = float(zone_rules.get("coverage_pct") or 40) / 100
    far = float(zone_rules.get("far") or 0.5)
    max_units_erf = zone_rules.get("max_units_per_erf")
    max_units_ha = zone_rules.get("max_units_per_ha")

    max_footprint = size_sqm * coverage
    max_buildable = size_sqm * far
    max_units_calc = 9999
    if max_units_erf:
        max_units_calc = min(max_units_calc, int(max_units_erf))
    if max_units_ha:
        max_units_calc = min(max_units_calc, int((size_sqm / 10_000) * max_units_ha))

    actual_units = min(target_units, max_units_calc)
    rezoning_required = target_units > max_units_calc

    total_build_sqm = unit_sqm * actual_units
    cost_build = total_build_sqm * build_rate
    cost_prof_fees = cost_build * 0.12
    cost_transfer = calculate_transfer_duty(land_price, tariff_year)
    cost_bulk = calculate_bulk_contributions(municipality, unit_type, actual_units, tariff_year)
    cost_total = land_price + cost_build + cost_prof_fees + cost_transfer + cost_bulk

    rent = MARKET_RENT_2026.get(unit_type, {}).get("default", 4_500)
    gross_monthly = rent * actual_units
    gross_annual = gross_monthly * 12

    yield_gross = (gross_annual / cost_total) * 100 if cost_total > 0 else 0
    yield_85 = (gross_annual * 0.85 / cost_total) * 100 if cost_total > 0 else 0
    viable = yield_85 >= 10.0

    score = min(100, max(0, int(yield_85 * 5)))

    return {
        "viable": viable,
        "score": score,
        "actual_units": actual_units,
        "max_units_allowed": max_units_calc,
        "rezoning_required": rezoning_required,
        "max_footprint_sqm": round(max_footprint, 1),
        "max_buildable_sqm": round(max_buildable, 1),
        "cost_land": land_price,
        "cost_build": round(cost_build, 2),
        "cost_professional_fees": round(cost_prof_fees, 2),
        "cost_bulk_contributions": round(cost_bulk, 2),
        "cost_transfer_duty": round(cost_transfer, 2),
        "cost_total": round(cost_total, 2),
        "rent_per_unit_monthly": rent,
        "gross_monthly_income": round(gross_monthly, 2),
        "gross_annual_income": round(gross_annual, 2),
        "yield_gross_pct": round(yield_gross, 2),
        "yield_at_85_occ_pct": round(yield_85, 2),
        "viability_notes": (
            "Viable at 85% occupancy" if viable
            else f"Yield {yield_85:.1f}% below 10% threshold at 85% occupancy"
        ),
        "dolomite_risk": "UNKNOWN",
        "score_schools": None,
        "score_transport": None,
        "score_amenities": None,
    }
```

- [ ] **Run tests — verify they pass**

```bash
cd apps/worker && uv run pytest tests/test_calculations.py -v
```

Expected: all 7 tests `PASSED`.

- [ ] **Commit**

```bash
git add apps/worker/services/ apps/worker/tests/
git commit -m "feat(worker): feasibility calculation engine with transfer duty + BSC"
```

---

## Task 6: FastAPI Feasibility Endpoint

**Files:**
- Create: `apps/worker/routers/feasibility.py`
- Modify: `apps/worker/main.py`
- Modify: `apps/worker/pyproject.toml`

- [ ] **Add slowapi to dependencies**

```toml
# apps/worker/pyproject.toml — add to dependencies list
"slowapi>=0.1.9",
```

```bash
cd apps/worker && uv sync
```

- [ ] **Write routers/feasibility.py**

```python
# apps/worker/routers/feasibility.py
from __future__ import annotations
from typing import Any, Literal
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from services.calculations import calculate_feasibility_score

router = APIRouter(prefix="/analyze", tags=["feasibility"])
limiter = Limiter(key_func=get_remote_address)


class ZoneRulesInput(BaseModel):
    coverage_pct: float | None = None
    far: float | None = None
    max_storeys: int | None = None
    max_units_per_erf: int | None = None
    max_units_per_ha: int | None = None


class FeasibilityRequest(BaseModel):
    address: str = Field(..., min_length=1, max_length=500)
    municipality: Literal["johannesburg", "tshwane", "ekurhuleni"]
    zone_code: str = Field(..., min_length=1, max_length=20)
    size_sqm: float = Field(..., ge=100, le=1_000_000)
    price: float = Field(..., ge=10_000, le=500_000_000)
    unit_type: Literal["bachelor", "1bed", "2bed"]
    target_units: int = Field(..., ge=1, le=200)
    zone_rules: ZoneRulesInput | None = None
    tariff_year: int = Field(default=2026, ge=2024, le=2030)

    @field_validator("zone_code")
    @classmethod
    def zone_code_alphanumeric(cls, v: str) -> str:
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("zone_code must be alphanumeric")
        return v.upper()


class FeasibilityResponse(BaseModel):
    viable: bool
    score: int
    actual_units: int
    max_units_allowed: int
    rezoning_required: bool
    max_footprint_sqm: float
    max_buildable_sqm: float
    cost_land: float
    cost_build: float
    cost_professional_fees: float
    cost_bulk_contributions: float
    cost_transfer_duty: float
    cost_total: float
    rent_per_unit_monthly: float
    gross_monthly_income: float
    gross_annual_income: float
    yield_gross_pct: float
    yield_at_85_occ_pct: float
    viability_notes: str
    dolomite_risk: str
    score_schools: int | None
    score_transport: int | None
    score_amenities: int | None


@router.post("/feasibility", response_model=FeasibilityResponse)
@limiter.limit("10/minute")
async def analyze_feasibility(
    request: Request, body: FeasibilityRequest
) -> dict[str, Any]:
    rules: dict[str, Any] = {}
    if body.zone_rules:
        rules = body.zone_rules.model_dump(exclude_none=True)

    return calculate_feasibility_score(
        land_price=body.price,
        size_sqm=body.size_sqm,
        unit_type=body.unit_type,
        target_units=body.target_units,
        municipality=body.municipality,
        zone_rules=rules,
        tariff_year=body.tariff_year,
    )
```

- [ ] **Update main.py**

```python
# apps/worker/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from routers.feasibility import router as feasibility_router

APP_VERSION = "0.1.0"

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="FGP Worker",
    version=APP_VERSION,
    description="First Generation Properties — geo processing worker",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(feasibility_router)


class HealthResponse(BaseModel):
    status: str
    version: str
    tariff_year: int


@app.get("/health")
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        tariff_year=settings.tariff_year,
    )
```

- [ ] **Start worker and smoke-test**

```bash
cd apps/worker && uv run uvicorn main:app --reload --port 8000
```

In a second terminal:
```bash
curl -s -X POST http://localhost:8000/analyze/feasibility \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Test St, Midrand",
    "municipality": "johannesburg",
    "zone_code": "RES3",
    "size_sqm": 1024,
    "price": 980000,
    "unit_type": "bachelor",
    "target_units": 8
  }' | python3 -m json.tool
```

Expected: JSON with `"viable": true` and `"score"` between 0–100.

- [ ] **Test rate limiting**

```bash
for i in {1..12}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/analyze/feasibility \
    -H "Content-Type: application/json" \
    -d '{"address":"x","municipality":"johannesburg","zone_code":"RES1","size_sqm":500,"price":500000,"unit_type":"bachelor","target_units":1}'
done
```

Expected: first 10 return `200`, 11th+ return `429`.

- [ ] **Commit**

```bash
git add apps/worker/routers/ apps/worker/main.py apps/worker/pyproject.toml apps/worker/uv.lock
git commit -m "feat(worker): POST /analyze/feasibility with Pydantic validation + rate limiting"
```

---

## Task 7: Next.js Server Infrastructure

**Files:**
- Create: `apps/web/lib/supabase-server.ts`
- Create: `apps/web/lib/feasibility-store.ts`
- Modify: `apps/web/package.json`

- [ ] **Install web dependencies**

```bash
cd apps/web
pnpm add zustand @hookform/resolvers react-hook-form zod
```

- [ ] **Write supabase-server.ts**

```typescript
// apps/web/lib/supabase-server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Write feasibility-store.ts**

```typescript
// apps/web/lib/feasibility-store.ts
import { create } from "zustand";

export type FeasibilityResult = {
  address: string;
  municipality: string;
  zoneCode: string;
  sizeSqm: number;
  price: number;
  unitType: string;
  targetUnits: number;
  viable: boolean;
  score: number;
  actualUnits: number;
  maxUnitsAllowed: number;
  rezoningRequired: boolean;
  maxFootprintSqm: number;
  maxBuildableSqm: number;
  costLand: number;
  costBuild: number;
  costProfessionalFees: number;
  costBulkContributions: number;
  costTransferDuty: number;
  costTotal: number;
  rentPerUnitMonthly: number;
  grossMonthlyIncome: number;
  grossAnnualIncome: number;
  yieldGrossPct: number;
  yieldAt85OccPct: number;
  viabilityNotes: string;
  dolomiteRisk: string;
};

type FeasibilityStore = {
  result: FeasibilityResult | null;
  formValues: Partial<FeasibilityResult> | null;
  setResult: (r: FeasibilityResult, formValues: Partial<FeasibilityResult>) => void;
  clear: () => void;
};

export const useFeasibilityStore = create<FeasibilityStore>((set) => ({
  result: null,
  formValues: null,
  setResult: (result, formValues) => set({ result, formValues }),
  clear: () => set({ result: null, formValues: null }),
}));
```

- [ ] **Commit**

```bash
git add apps/web/lib/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): server Supabase client + Zustand feasibility store"
```

---

## Task 8: Next.js API Routes

**Files:**
- Create: `apps/web/app/api/feasibility/route.ts`
- Create: `apps/web/app/api/feasibility/save/route.ts`
- Create: `apps/web/app/api/projects/route.ts`
- Create: `apps/web/app/api/projects/[id]/route.ts`
- Create: `apps/web/app/api/projects/[id]/checkins/route.ts`

- [ ] **Write app/api/feasibility/route.ts**

```typescript
// apps/web/app/api/feasibility/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.string().min(1).max(20),
  size_sqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed"]),
  target_units: z.number().int().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const workerUrl = process.env.WORKER_URL ?? "http://localhost:8000";
  const res = await fetch(`${workerUrl}/analyze/feasibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
```

- [ ] **Write app/api/feasibility/save/route.ts**

```typescript
// apps/web/app/api/feasibility/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings, feasibilityReports } from "@fgp/database";

const schema = z.object({
  address: z.string().min(1).max(500),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zoneCode: z.string().min(1).max(20),
  sizeSqm: z.number().min(100).max(1_000_000),
  price: z.number().min(10_000).max(500_000_000),
  unitType: z.enum(["bachelor", "1bed", "2bed"]),
  targetUnits: z.number().int().min(1).max(200),
  viable: z.boolean(),
  score: z.number().int().min(0).max(100),
  actualUnits: z.number().int(),
  maxUnitsAllowed: z.number().int(),
  rezoningRequired: z.boolean(),
  maxFootprintSqm: z.number(),
  maxBuildableSqm: z.number(),
  costLand: z.number(),
  costBuild: z.number(),
  costProfessionalFees: z.number(),
  costBulkContributions: z.number(),
  costTransferDuty: z.number(),
  costTotal: z.number(),
  rentPerUnitMonthly: z.number(),
  grossMonthlyIncome: z.number(),
  grossAnnualIncome: z.number(),
  yieldGrossPct: z.number(),
  yieldAt85OccPct: z.number(),
  viabilityNotes: z.string(),
  dolomiteRisk: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  const [listing] = await db.insert(listings).values({
    source: "manual",
    address: d.address,
    municipality: d.municipality,
    sizeSqm: String(d.sizeSqm),
    price: String(d.price),
    zoneCode: d.zoneCode,
    dolomiteRisk: d.dolomiteRisk,
    status: "analyzed",
    feasibilityScore: d.score,
  }).returning();

  const [report] = await db.insert(feasibilityReports).values({
    listingId: listing.id,
    unitType: d.unitType,
    targetUnits: d.targetUnits,
    buildRatePerSqm: "13500",
    tariffYear: 2026,
    maxUnitsAllowed: d.maxUnitsAllowed,
    maxBuildableSqm: String(d.maxBuildableSqm),
    maxFootprintSqm: String(d.maxFootprintSqm),
    rezoningRequired: d.rezoningRequired,
    costLand: String(d.costLand),
    costBuild: String(d.costBuild),
    costProfessionalFees: String(d.costProfessionalFees),
    costBulkContributions: String(d.costBulkContributions),
    costTransferDuty: String(d.costTransferDuty),
    costTotal: String(d.costTotal),
    rentPerUnitMonthly: String(d.rentPerUnitMonthly),
    grossMonthlyIncome: String(d.grossMonthlyIncome),
    grossAnnualIncome: String(d.grossAnnualIncome),
    yieldGrossPct: String(d.yieldGrossPct),
    yieldAt85OccPct: String(d.yieldAt85OccPct),
    viable: d.viable,
    viabilityNotes: d.viabilityNotes,
  }).returning();

  return NextResponse.json({ listingId: listing.id, reportId: report.id });
}
```

- [ ] **Write app/api/projects/route.ts**

```typescript
// apps/web/app/api/projects/route.ts
import { NextResponse } from "next/server";
import { db, projects } from "@fgp/database";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return NextResponse.json(rows);
}
```

- [ ] **Write app/api/projects/[id]/route.ts**

```typescript
// apps/web/app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, projects, projectBudgetItems, projectContacts, projectDecisions, milestones, projectCheckins } from "@fgp/database";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [budget, contacts, decisions, projectMilestones, checkins] = await Promise.all([
    db.select().from(projectBudgetItems).where(eq(projectBudgetItems.projectId, projectId)),
    db.select().from(projectContacts).where(eq(projectContacts.projectId, projectId)),
    db.select().from(projectDecisions).where(eq(projectDecisions.projectId, projectId)).orderBy(desc(projectDecisions.decidedAt)),
    db.select().from(milestones).where(eq(milestones.projectId, projectId)),
    db.select().from(projectCheckins).where(eq(projectCheckins.projectId, projectId)).orderBy(desc(projectCheckins.weekOf)).limit(1),
  ]);

  return NextResponse.json({ project, budget, contacts, decisions, milestones: projectMilestones, latestCheckin: checkins[0] ?? null });
}
```

- [ ] **Write app/api/projects/[id]/checkins/route.ts**

```typescript
// apps/web/app/api/projects/[id]/checkins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, projectCheckins } from "@fgp/database";

const schema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attorneyStatus: z.string().max(1000).optional(),
  savingsConfirmed: z.boolean().optional(),
  supplierProgress: z.string().max(1000).optional(),
  openIssues: z.string().max(2000).optional(),
  actionsNextCall: z.string().max(2000).optional(),
  decisionsNeeded: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  if (isNaN(projectId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const [checkin] = await db.insert(projectCheckins).values({
    projectId,
    ...parsed.data,
  }).returning();

  return NextResponse.json(checkin, { status: 201 });
}
```

- [ ] **Commit**

```bash
git add apps/web/app/api/
git commit -m "feat(web): API routes — feasibility proxy+save, projects CRUD, check-ins"
```

---

## Task 9: Evaluate Land Form + Result Page

**Files:**
- Create: `apps/web/app/evaluate/page.tsx`
- Create: `apps/web/app/evaluate/result/page.tsx`

- [ ] **Write evaluate/page.tsx**

```tsx
// apps/web/app/evaluate/page.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";

const schema = z.object({
  address: z.string().min(1, "Required"),
  municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]),
  zone_code: z.enum(["RES1", "RES2", "RES3", "RES4", "COM1"]),
  size_sqm: z.coerce.number().min(100).max(1_000_000),
  price: z.coerce.number().min(10_000).max(500_000_000),
  unit_type: z.enum(["bachelor", "1bed", "2bed"]),
  target_units: z.coerce.number().int().min(1).max(200),
});

type FormValues = z.infer<typeof schema>;

export default function EvaluatePage() {
  const router = useRouter();
  const setResult = useFeasibilityStore((s) => s.setResult);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { municipality: "johannesburg", zone_code: "RES3", unit_type: "bachelor", target_units: 8 },
  });

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/feasibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) return;
    const data = await res.json();
    setResult(
      {
        address: values.address, municipality: values.municipality, zoneCode: values.zone_code,
        sizeSqm: values.size_sqm, price: values.price, unitType: values.unit_type, targetUnits: values.target_units,
        viable: data.viable, score: data.score, actualUnits: data.actual_units,
        maxUnitsAllowed: data.max_units_allowed, rezoningRequired: data.rezoning_required,
        maxFootprintSqm: data.max_footprint_sqm, maxBuildableSqm: data.max_buildable_sqm,
        costLand: data.cost_land, costBuild: data.cost_build, costProfessionalFees: data.cost_professional_fees,
        costBulkContributions: data.cost_bulk_contributions, costTransferDuty: data.cost_transfer_duty,
        costTotal: data.cost_total, rentPerUnitMonthly: data.rent_per_unit_monthly,
        grossMonthlyIncome: data.gross_monthly_income, grossAnnualIncome: data.gross_annual_income,
        yieldGrossPct: data.yield_gross_pct, yieldAt85OccPct: data.yield_at_85_occ_pct,
        viabilityNotes: data.viability_notes, dolomiteRisk: data.dolomite_risk,
      },
      values
    );
    router.push("/evaluate/result");
  }

  const field = "bg-bg-surface border border-border rounded-[8px] px-3 py-2 text-text-primary font-mono text-sm w-full focus:outline-none focus:border-accent-blue";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block";
  const err = "text-accent-red text-xs mt-1";

  return (
    <div className="max-w-xl mx-auto p-8">
      <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">New Analysis</p>
      <h1 className="font-heading text-2xl font-bold text-text-primary mb-6">Evaluate Land</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div>
          <label className={label}>Address</label>
          <input {...register("address")} placeholder="123 Main St, Midrand" className={field} />
          {errors.address && <p className={err}>{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Municipality</label>
            <select {...register("municipality")} className={field}>
              <option value="johannesburg">Johannesburg</option>
              <option value="tshwane">Tshwane</option>
              <option value="ekurhuleni">Ekurhuleni</option>
            </select>
          </div>
          <div>
            <label className={label}>Zone Code</label>
            <select {...register("zone_code")} className={field}>
              {["RES1","RES2","RES3","RES4","COM1"].map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Size (m²)</label>
            <input type="number" {...register("size_sqm")} className={field} />
            {errors.size_sqm && <p className={err}>{errors.size_sqm.message}</p>}
          </div>
          <div>
            <label className={label}>Price (ZAR)</label>
            <input type="number" {...register("price")} className={field} />
            {errors.price && <p className={err}>{errors.price.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Unit Type</label>
            <select {...register("unit_type")} className={field}>
              <option value="bachelor">Bachelor (35m²)</option>
              <option value="1bed">1 Bedroom (55m²)</option>
              <option value="2bed">2 Bedroom (85m²)</option>
            </select>
          </div>
          <div>
            <label className={label}>Target Units</label>
            <input type="number" {...register("target_units")} className={field} />
            {errors.target_units && <p className={err}>{errors.target_units.message}</p>}
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent-blue hover:bg-accent-blue-dark text-white font-mono text-sm font-semibold py-2.5 rounded-[8px] transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Calculating..." : "Run Analysis"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Write evaluate/result/page.tsx**

```tsx
// apps/web/app/evaluate/result/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFeasibilityStore } from "@/lib/feasibility-store";

const fmt = (n: number) => `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function EvaluateResultPage() {
  const router = useRouter();
  const { result, formValues, clear } = useFeasibilityStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ listingId: number; reportId: number } | null>(null);

  useEffect(() => {
    if (!result) router.replace("/evaluate");
  }, [result, router]);

  if (!result) return null;

  async function keep() {
    if (!result || !formValues) return;
    setSaving(true);
    const res = await fetch("/api/feasibility/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: result.address, municipality: result.municipality, zoneCode: result.zoneCode,
        sizeSqm: result.sizeSqm, price: result.price, unitType: result.unitType, targetUnits: result.targetUnits,
        viable: result.viable, score: result.score, actualUnits: result.actualUnits,
        maxUnitsAllowed: result.maxUnitsAllowed, rezoningRequired: result.rezoningRequired,
        maxFootprintSqm: result.maxFootprintSqm, maxBuildableSqm: result.maxBuildableSqm,
        costLand: result.costLand, costBuild: result.costBuild, costProfessionalFees: result.costProfessionalFees,
        costBulkContributions: result.costBulkContributions, costTransferDuty: result.costTransferDuty,
        costTotal: result.costTotal, rentPerUnitMonthly: result.rentPerUnitMonthly,
        grossMonthlyIncome: result.grossMonthlyIncome, grossAnnualIncome: result.grossAnnualIncome,
        yieldGrossPct: result.yieldGrossPct, yieldAt85OccPct: result.yieldAt85OccPct,
        viabilityNotes: result.viabilityNotes, dolomiteRisk: result.dolomiteRisk,
      }),
    });
    const data = await res.json();
    setSaved(data);
    setSaving(false);
  }

  const card = "bg-bg-surface border border-border rounded-card p-5";
  const statLabel = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1";
  const statVal = "font-mono text-sm font-semibold text-text-primary";

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-1">Analysis Result</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{result.address}</h1>
          <p className="text-text-muted font-mono text-xs mt-1">{result.municipality.toUpperCase()} · {result.zoneCode} · {result.sizeSqm.toLocaleString()}m²</p>
        </div>
        <div className={`px-4 py-2 rounded-pill font-mono text-sm font-bold border ${result.viable ? "bg-accent-green/10 border-accent-green text-accent-green" : "bg-accent-red/10 border-accent-red text-accent-red"}`}>
          {result.viable ? "VIABLE" : "NOT VIABLE"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={card}>
          <p className={statLabel}>Score</p>
          <p className="font-mono text-3xl font-bold text-text-primary">{result.score}<span className="text-text-muted text-lg">/100</span></p>
        </div>
        <div className={card}>
          <p className={statLabel}>Yield @ 85% occ</p>
          <p className={`font-mono text-2xl font-bold ${result.yieldAt85OccPct >= 10 ? "text-accent-green" : "text-accent-red"}`}>{pct(result.yieldAt85OccPct)}</p>
        </div>
        <div className={card}>
          <p className={statLabel}>Units (actual / target)</p>
          <p className="font-mono text-2xl font-bold text-text-primary">{result.actualUnits}<span className="text-text-muted text-lg">/{result.targetUnits}</span></p>
          {result.rezoningRequired && <p className="text-accent-amber text-xs mt-1">Rezoning required</p>}
        </div>
      </div>

      <div className={card}>
        <p className={statLabel + " mb-3"}>Cost Breakdown</p>
        <div className="flex flex-col gap-2">
          {[
            ["Land", result.costLand],
            ["Build", result.costBuild],
            ["Professional Fees (12%)", result.costProfessionalFees],
            ["Bulk Service Contributions", result.costBulkContributions],
            ["Transfer Duty", result.costTransferDuty],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-xs font-mono">
              <span className="text-text-muted">{label}</span>
              <span className="text-text-primary">{fmt(val as number)}</span>
            </div>
          ))}
          <div className="border-t border-border mt-1 pt-2 flex justify-between text-sm font-mono font-bold">
            <span className="text-text-muted">Total Investment</span>
            <span className="text-text-primary">{fmt(result.costTotal)}</span>
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={statLabel + " mb-3"}>Income Projection</p>
        <div className="grid grid-cols-3 gap-4">
          <div><p className={statLabel}>Rent/Unit/Mo</p><p className={statVal}>{fmt(result.rentPerUnitMonthly)}</p></div>
          <div><p className={statLabel}>Gross Monthly</p><p className={statVal}>{fmt(result.grossMonthlyIncome)}</p></div>
          <div><p className={statLabel}>Gross Annual</p><p className={statVal}>{fmt(result.grossAnnualIncome)}</p></div>
        </div>
      </div>

      <p className="text-text-muted font-mono text-xs">{result.viabilityNotes}</p>

      <div className="flex gap-3">
        {!saved ? (
          <button onClick={keep} disabled={saving} className="bg-accent-blue hover:bg-accent-blue-dark text-white font-mono text-sm font-semibold px-6 py-2.5 rounded-card transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Keep this analysis"}
          </button>
        ) : (
          <p className="text-accent-green font-mono text-sm">Saved — report #{saved.reportId}</p>
        )}
        <button onClick={() => { clear(); router.push("/evaluate"); }} className="border border-border text-text-muted hover:text-text-primary font-mono text-sm px-6 py-2.5 rounded-card transition-colors">
          New Analysis
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Test the full evaluate flow manually**

```bash
# terminal 1 — worker
cd apps/worker && uv run uvicorn main:app --reload --port 8000

# terminal 2 — web
cd apps/web && pnpm dev
```

Open http://localhost:3000/evaluate, fill the form, submit. Verify:
- Result page shows score, cost breakdown, yield
- "Keep this analysis" saves to DB (check Supabase table viewer)
- "New Analysis" clears state and returns to form

- [ ] **Commit**

```bash
git add apps/web/app/evaluate/
git commit -m "feat(web): Evaluate Land form + ephemeral result page with save flow"
```

---

## Task 10: Sidebar Layout

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/_components/Sidebar.tsx`

- [ ] **Write Sidebar.tsx**

```tsx
// apps/web/app/_components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Project = { id: number; name: string; status: string };

export function Sidebar({ projects }: { projects: Project[] }) {
  const path = usePathname();
  const active = (href: string) =>
    path === href || path.startsWith(href + "/")
      ? "text-text-primary bg-border"
      : "text-text-muted hover:text-text-primary hover:bg-border/50";

  return (
    <aside className="w-52 flex-shrink-0 bg-bg-header border-r border-border min-h-[calc(100vh-58px)] px-3 py-4 flex flex-col gap-1">
      <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase px-2 mb-2">Projects</p>
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active(`/projects/${p.id}`)}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.status === "planning" ? "bg-accent-amber" : p.status === "construction" ? "bg-accent-green" : "bg-text-dim"}`} />
          {p.name}
        </Link>
      ))}
      <Link
        href="/evaluate"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active("/evaluate")}`}
      >
        <span className="text-text-dim">+</span>
        <span>Evaluate land</span>
      </Link>

      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-1">
        <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase px-2 mb-1">Tools</p>
        <Link href="/settings" className={`px-2 py-1.5 rounded-[6px] text-xs font-mono transition-colors ${active("/settings")}`}>
          Settings
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Update layout.tsx to use sidebar**

Replace the `<main>` section in `apps/web/app/layout.tsx`:

```tsx
// Replace the existing <main> tag and everything below it (before closing </body>)
// First add this import at the top:
import { Sidebar } from "./_components/Sidebar";

// Then fetch projects server-side — add this before the return statement in RootLayout:
// NOTE: This is a Server Component so async fetch is fine
```

Replace the entire `RootLayout` function with:

```tsx
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let projects: { id: number; name: string; status: string }[] = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects`, { cache: "no-store" });
    if (res.ok) projects = await res.json();
  } catch {}

  return (
    <html lang="en" className={`${playfair.variable} ${dmMono.variable}`}>
      <body className="bg-bg-base text-text-primary min-h-screen font-mono">
        <header className="bg-bg-header border-b border-border sticky top-0 z-50 h-[58px] px-8 flex items-center gap-10">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-accent-blue-dark flex items-center justify-center text-sm">
              🏗
            </div>
            <div>
              <div className="font-heading text-sm text-text-primary font-bold leading-none">First Generation</div>
              <div className="font-mono text-[9px] text-text-muted tracking-[1.5px] uppercase">Properties</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xs font-bold">TM</div>
            <span className="font-mono text-xs text-text-muted">T. Mkhabela</span>
          </div>
        </header>
        <div className="flex min-h-[calc(100vh-58px)]">
          <Sidebar projects={projects} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Add NEXT_PUBLIC_SITE_URL to .env.example**

```bash
echo "NEXT_PUBLIC_SITE_URL=http://localhost:3000" >> .env.example
```

- [ ] **Verify sidebar renders with Soshanguve project**

Open http://localhost:3000 — sidebar should show `● Soshanguve Build` and `+ Evaluate land`.

- [ ] **Commit**

```bash
git add apps/web/app/_components/ apps/web/app/layout.tsx .env.example
git commit -m "feat(web): sidebar navigation with projects list + evaluate land link"
```

---

## Task 11: Projects List Page

**Files:**
- Create: `apps/web/app/projects/page.tsx`

- [ ] **Write projects/page.tsx**

```tsx
// apps/web/app/projects/page.tsx
import Link from "next/link";

type Project = {
  id: number; name: string; status: string; township: string | null;
  erfNumber: string | null; phase1TargetZar: string | null; monthlySavingZar: string | null;
};

async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

const statusColour: Record<string, string> = {
  planning: "text-accent-amber border-accent-amber",
  compliance: "text-accent-blue border-accent-blue",
  construction: "text-accent-green border-accent-green",
  complete: "text-text-muted border-text-muted",
};

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <div className="p-8">
      <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-2">Active</p>
      <h1 className="font-heading text-2xl font-bold text-text-primary mb-6">Projects</h1>
      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}
            className="bg-bg-surface border border-border rounded-card p-5 hover:border-accent-blue/50 transition-colors flex justify-between items-start">
            <div>
              <div className="font-heading text-lg text-text-primary font-bold mb-1">{p.name}</div>
              {p.township && <div className="text-text-muted font-mono text-xs">ERF {p.erfNumber} · {p.township}</div>}
              {p.phase1TargetZar && (
                <div className="text-text-muted font-mono text-xs mt-1">
                  Target: R {Number(p.phase1TargetZar).toLocaleString("en-ZA")} · Saving: R {Number(p.monthlySavingZar ?? 0).toLocaleString("en-ZA")}/mo
                </div>
              )}
            </div>
            <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-pill uppercase tracking-widest ${statusColour[p.status] ?? "text-text-muted border-text-muted"}`}>
              {p.status}
            </span>
          </Link>
        ))}
        {projects.length === 0 && <p className="text-text-muted font-mono text-sm">No projects yet. Use "Evaluate land" to start.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add apps/web/app/projects/page.tsx
git commit -m "feat(web): projects list page"
```

---

## Task 12: Project Detail Page

**Files:**
- Create: `apps/web/app/projects/[id]/page.tsx`
- Create: `apps/web/app/projects/[id]/_components/ThisWeek.tsx`
- Create: `apps/web/app/projects/[id]/_components/FinanceStrip.tsx`
- Create: `apps/web/app/projects/[id]/_components/MilestonesTimeline.tsx`
- Create: `apps/web/app/projects/[id]/_components/BudgetTable.tsx`
- Create: `apps/web/app/projects/[id]/_components/ContactsTable.tsx`
- Create: `apps/web/app/projects/[id]/_components/DecisionLog.tsx`
- Create: `apps/web/app/projects/[id]/_components/CheckInModal.tsx`

- [ ] **Write page.tsx (server, fetches and composes all sections)**

```tsx
// apps/web/app/projects/[id]/page.tsx
import { notFound } from "next/navigation";
import { ThisWeek } from "./_components/ThisWeek";
import { FinanceStrip } from "./_components/FinanceStrip";
import { MilestonesTimeline } from "./_components/MilestonesTimeline";
import { BudgetTable } from "./_components/BudgetTable";
import { ContactsTable } from "./_components/ContactsTable";
import { DecisionLog } from "./_components/DecisionLog";

async function getProject(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/projects/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProject(id);
  if (!data) notFound();

  const { project, budget, contacts, decisions, milestones, latestCheckin } = data;

  return (
    <div className="p-8 flex flex-col gap-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-text-muted tracking-widest uppercase mb-1">Project</p>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{project.name}</h1>
          {project.township && (
            <p className="text-text-muted font-mono text-xs mt-1">ERF {project.erfNumber} · {project.township}</p>
          )}
        </div>
        <span className="text-[10px] font-mono border border-accent-amber text-accent-amber px-3 py-1 rounded-pill uppercase tracking-widest">
          {project.status}
        </span>
      </div>

      <ThisWeek projectId={project.id} latestCheckin={latestCheckin} />
      <FinanceStrip project={project} milestones={milestones} />
      <MilestonesTimeline milestones={milestones} />
      <BudgetTable items={budget} />
      <ContactsTable contacts={contacts} />
      <DecisionLog decisions={decisions} />
    </div>
  );
}
```

- [ ] **Write ThisWeek.tsx**

```tsx
// apps/web/app/projects/[id]/_components/ThisWeek.tsx
"use client";
import { useState } from "react";
import { CheckInModal } from "./CheckInModal";

type Checkin = {
  weekOf: string; attorneyStatus: string | null; savingsConfirmed: boolean | null;
  supplierProgress: string | null; openIssues: string | null;
  actionsNextCall: string | null; decisionsNeeded: string | null;
} | null;

export function ThisWeek({ projectId, latestCheckin }: { projectId: number; latestCheckin: Checkin }) {
  const [open, setOpen] = useState(false);

  const actions = latestCheckin?.actionsNextCall
    ?.split("\n").filter(Boolean)
    ?? ["Follow up with attorney", "Confirm savings deposit", "Get architect quotes"];

  return (
    <div className="bg-bg-surface border border-accent-green/20 rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono text-accent-green tracking-widest uppercase">This Week</p>
        <button onClick={() => setOpen(true)} className="text-[10px] font-mono border border-border text-text-muted hover:text-text-primary px-3 py-1 rounded-[6px] transition-colors">
          Log check-in
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 border border-accent-amber rounded-[3px] flex-shrink-0" />
            <span className="text-text-primary font-mono text-xs">{action}</span>
          </div>
        ))}
      </div>
      {latestCheckin?.openIssues && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1">Open Issues</p>
          <p className="text-text-muted font-mono text-xs">{latestCheckin.openIssues}</p>
        </div>
      )}
      {open && <CheckInModal projectId={projectId} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Write FinanceStrip.tsx**

```tsx
// apps/web/app/projects/[id]/_components/FinanceStrip.tsx
type Milestone = { targetDate: string; milestone: string; status: string; isMajor: boolean };
type Project = { monthlySavingZar: string | null; phase1TargetZar: string | null };

export function FinanceStrip({ project, milestones }: { project: Project; milestones: Milestone[] }) {
  const saved = 3000; // TODO: compute from checkins cash flow in Phase 2
  const nextMajor = milestones.find(m => m.isMajor && m.status === "PENDING");
  const breakGround = milestones.find(m => m.milestone.includes("BREAK GROUND"));

  const monthlyTarget = Number(project.phase1TargetZar ?? 210_000);
  const monthly = Number(project.monthlySavingZar ?? 3000);
  const monthsToTarget = Math.ceil(monthlyTarget / monthly);

  const statCard = "bg-bg-surface border border-border rounded-card p-4";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className={statCard}>
          <p className={label}>Saved to Date</p>
          <p className="font-mono text-2xl font-bold text-accent-green">R {saved.toLocaleString("en-ZA")}</p>
          <p className="text-text-muted font-mono text-xs mt-1">R {monthly.toLocaleString("en-ZA")}/mo combined</p>
        </div>
        <div className={statCard}>
          <p className={label}>Next Milestone</p>
          <p className="font-mono text-sm font-semibold text-accent-amber leading-tight">
            {nextMajor?.milestone.replace("★ ", "") ?? "—"}
          </p>
          <p className="text-text-muted font-mono text-xs mt-1">{nextMajor?.targetDate ?? "—"}</p>
        </div>
        <div className={statCard}>
          <p className={label}>Break Ground</p>
          <p className="font-mono text-sm font-semibold text-text-primary">{breakGround?.targetDate ?? "Oct 2028"}</p>
          <p className="text-text-muted font-mono text-xs mt-1">{monthsToTarget} months total</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Write MilestonesTimeline.tsx**

```tsx
// apps/web/app/projects/[id]/_components/MilestonesTimeline.tsx
type Milestone = { id: number; targetDate: string; milestone: string; status: string; owner: string | null; isMajor: boolean };

const statusDot: Record<string, string> = {
  IN_PROGRESS: "bg-accent-amber",
  COMPLETED: "bg-accent-green",
  PENDING: "bg-bg-surface border border-border",
};

export function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-5">Milestones</p>
      <div className="flex flex-col gap-0">
        {milestones.map((m, i) => (
          <div key={m.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${statusDot[m.status] ?? statusDot.PENDING}`} />
              {i < milestones.length - 1 && <div className="w-px flex-1 bg-border min-h-[28px]" />}
            </div>
            <div className="pb-5">
              <p className={`font-mono text-sm ${m.status === "PENDING" && !m.isMajor ? "text-text-muted" : "text-text-primary"}`}>
                {m.milestone}
              </p>
              <p className="font-mono text-xs text-text-muted mt-0.5">
                {m.targetDate}{m.owner ? ` · ${m.owner}` : ""}
                {m.status === "IN_PROGRESS" && <span className="ml-2 text-accent-amber">IN PROGRESS</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Write BudgetTable.tsx**

```tsx
// apps/web/app/projects/[id]/_components/BudgetTable.tsx
type BudgetItem = { id: number; category: string; item: string; unit: string | null; quantity: string | null; unitCost: string | null; totalCost: string | null; actualCost: string | null; status: string };

const fmt = (n: string | null) => n ? `R ${Number(n).toLocaleString("en-ZA")}` : "—";

export function BudgetTable({ items }: { items: BudgetItem[] }) {
  const categories = [...new Set(items.map(i => i.category))];
  const total = items.reduce((s, i) => s + Number(i.totalCost ?? 0), 0);

  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Budget</p>
      {categories.map(cat => {
        const rows = items.filter(i => i.category === cat);
        const catTotal = rows.reduce((s, i) => s + Number(i.totalCost ?? 0), 0);
        return (
          <div key={cat} className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[9px] font-mono text-text-dim tracking-widest uppercase">{cat}</p>
              <p className="text-[10px] font-mono text-text-muted">{fmt(String(catTotal))}</p>
            </div>
            {rows.map(row => (
              <div key={row.id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                <div className="flex gap-3">
                  <span className="font-mono text-xs text-text-primary w-36 truncate">{row.item}</span>
                  <span className="font-mono text-xs text-text-muted">{row.quantity ? `${row.quantity} ${row.unit ?? ""}` : row.unit ?? ""}</span>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="font-mono text-xs text-text-muted w-24 text-right">{fmt(row.totalCost)}</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${row.status === "paid" ? "bg-accent-green/10 text-accent-green" : row.status === "quoted" ? "bg-accent-blue/10 text-accent-blue" : "text-text-dim"}`}>
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="border-t border-border pt-3 flex justify-between">
        <span className="font-mono text-sm font-bold text-text-muted">Total</span>
        <span className="font-mono text-sm font-bold text-text-primary">{fmt(String(total))}</span>
      </div>
    </div>
  );
}
```

- [ ] **Write ContactsTable.tsx**

```tsx
// apps/web/app/projects/[id]/_components/ContactsTable.tsx
type Contact = { id: number; role: string; name: string | null; phone: string | null; email: string | null; status: string; notes: string | null };

const statusColour: Record<string, string> = {
  active: "text-accent-green",
  pending: "text-accent-amber",
  inactive: "text-text-dim",
};

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Contacts</p>
      <div className="flex flex-col gap-3">
        {contacts.map(c => (
          <div key={c.id} className="flex justify-between items-start">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">{c.role}</p>
              <p className="font-mono text-sm text-text-primary mt-0.5">{c.name ?? "TO BE HIRED"}</p>
              {c.phone && <p className="font-mono text-xs text-text-muted mt-0.5">{c.phone}</p>}
              {c.email && <p className="font-mono text-xs text-text-muted">{c.email}</p>}
              {c.notes && <p className="font-mono text-xs text-text-dim mt-1">{c.notes}</p>}
            </div>
            <span className={`font-mono text-xs ${statusColour[c.status] ?? "text-text-muted"}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Write DecisionLog.tsx**

```tsx
// apps/web/app/projects/[id]/_components/DecisionLog.tsx
type Decision = { id: number; decidedAt: string; decision: string; rationale: string | null; impact: string | null };

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Decision Log</p>
      <div className="flex flex-col gap-4">
        {decisions.map(d => (
          <div key={d.id} className="border-l-2 border-border pl-4">
            <p className="text-[10px] font-mono text-text-dim mb-1">{d.decidedAt}</p>
            <p className="font-mono text-sm text-text-primary">{d.decision}</p>
            {d.rationale && <p className="font-mono text-xs text-text-muted mt-1">{d.rationale}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Write CheckInModal.tsx**

```tsx
// apps/web/app/projects/[id]/_components/CheckInModal.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attorneyStatus: z.string().max(1000).optional(),
  savingsConfirmed: z.boolean().optional(),
  supplierProgress: z.string().max(1000).optional(),
  openIssues: z.string().max(2000).optional(),
  actionsNextCall: z.string().max(2000).optional(),
  decisionsNeeded: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CheckInModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { weekOf: today },
  });

  async function onSubmit(values: FormValues) {
    await fetch(`/api/projects/${projectId}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    onClose();
  }

  const field = "bg-bg-base border border-border rounded-[6px] px-3 py-2 text-text-primary font-mono text-xs w-full focus:outline-none focus:border-accent-blue resize-none";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-surface border border-border rounded-panel p-6 w-full max-w-lg flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="font-heading text-lg font-bold text-text-primary">Weekly Check-In</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary font-mono text-xs">✕ close</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className={label}>Week of</label>
            <input type="date" {...register("weekOf")} className={field} />
          </div>
          <div>
            <label className={label}>Attorney status (transfer)</label>
            <textarea {...register("attorneyStatus")} rows={2} className={field} placeholder="Cassius contacted? Response received?" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" {...register("savingsConfirmed")} id="savings" className="accent-accent-blue" />
            <label htmlFor="savings" className="font-mono text-xs text-text-primary">Savings confirmed (both deposits made)</label>
          </div>
          <div>
            <label className={label}>Supplier / quote progress</label>
            <textarea {...register("supplierProgress")} rows={2} className={field} placeholder="Any quotes received this week?" />
          </div>
          <div>
            <label className={label}>Open issues / blockers</label>
            <textarea {...register("openIssues")} rows={2} className={field} />
          </div>
          <div>
            <label className={label}>Actions before next call</label>
            <textarea {...register("actionsNextCall")} rows={3} className={field} placeholder="One action per line" />
          </div>
          <div>
            <label className={label}>Decisions needed</label>
            <textarea {...register("decisionsNeeded")} rows={2} className={field} />
          </div>
          <button type="submit" disabled={isSubmitting} className="bg-accent-blue hover:bg-accent-blue-dark text-white font-mono text-sm font-semibold py-2.5 rounded-card transition-colors disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save check-in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Verify project detail page end-to-end**

Navigate to http://localhost:3000/projects/1 — should show all 6 sections. Log a check-in via the modal. Refresh — "This Week" section should update with actions from the new check-in.

- [ ] **Commit**

```bash
git add apps/web/app/projects/
git commit -m "feat(web): project detail page — all 6 sections + weekly check-in modal"
```

---

## Task 13: Type-check + Smoke Test

- [ ] **Run TypeScript check**

```bash
pnpm typecheck
```

Expected: `0 errors`.

Fix any type errors before proceeding.

- [ ] **Run worker tests**

```bash
cd apps/worker && uv run pytest tests/ -v
```

Expected: all tests `PASSED`.

- [ ] **Full flow smoke test**

1. Open http://localhost:3000 — sidebar shows Soshanguve Build
2. Click `+ Evaluate land` — form loads
3. Fill: address=`123 Test Rd Midrand`, municipality=`johannesburg`, zone=`RES3`, size=`1024`, price=`980000`, units=`bachelor`, target=`8`
4. Submit — result page shows score, cost breakdown, yields
5. Click "Keep this analysis" — saved confirmation appears
6. Navigate to http://localhost:3000/projects/1 — all sections render
7. Click "Log check-in" — modal opens, fill and save, verify actions update

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: phase 1 complete — projects tracker + evaluate land end-to-end"
```

---

## Success Criteria Checklist

- [ ] Feasibility analysis returns result in < 10s
- [ ] Soshanguve project page shows this week / finance / milestones / budget / contacts / decisions
- [ ] Weekly check-in can be logged and is reflected in "This Week" section
- [ ] "Keep this analysis" saves report + listing to DB
- [ ] All API inputs validated by Zod (web) and Pydantic (worker)
- [ ] Rate limiter returns 429 after 10 req/min on `/analyze/feasibility`
- [ ] No f-string SQL anywhere — all queries through Drizzle/psycopg3 parameterisation
- [ ] TypeScript strict mode passes with 0 errors
