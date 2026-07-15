# Signature Property Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the handoff's functional Scout, Parcel Detail, and Cost Oracle signature views with persisted listing markers, live parcel intelligence, interactive 3D massing, and proportional cost bars.

**Architecture:** Extend the authenticated listings read contract with server-derived latitude/longitude and latest saved yield without exposing raw PostGIS values. Replace runtime CDN map loading with the pinned MapLibre package and one reusable map surface for Scout and Parcel Detail. Keep Three.js isolated in a client-only massing component with deterministic cleanup, and keep Cost Oracle bars as pure presentation over the trusted server calculation result.

**Tech Stack:** Next.js 16, React 19, TypeScript, MapLibre GL JS 4.7.1, Three.js 0.160.0, existing Supabase/PostGIS/Drizzle and feasibility contracts.

## Global Constraints

- The authoritative references are `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/README.md` and screenshots `02-scout.png`, `03-parcel-detail.png`, and `04-cost-oracle.png`.
- Preserve server-owned authentication, Viewer read-only behavior, trusted feasibility recomputation, and creator ownership until the later workspace-tenancy task.
- Never accept browser-supplied coordinates, yields, parcel facts, or costs as trusted persisted output.
- Map/listing failures must degrade to usable search, coordinate entry, and text facts; no blank page or unhandled promise.
- Pin MapLibre to `4.7.1` and Three.js plus its types to `0.160.0`; do not ship CDN runtime code.
- Use semantic theme tokens, exact `formatZar`, sentence case, the portal motion curve, 860px stacking, and 320px containment.
- Every task captures genuine RED before production changes and ends with focused smoke, typecheck, lint, build, relevant authenticated runtime checks, diff review, report, commit, and independent review.

---

### Task 1: Persisted Scout lead cards and map overlays

**Files:**
- Create: `apps/web/lib/listing-spatial.ts`
- Create: `apps/web/app/scout/_components/ScoutLeadCard.tsx`
- Create: `scripts/signature-views-smoke.ts`
- Modify: `apps/web/app/api/listings/route.ts`
- Modify: `apps/web/app/scout/page.tsx`
- Modify: `apps/web/app/scout/_components/ScoutMap.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `ListingSpatialSummary { latitude: number | null; longitude: number | null; yieldAt85OccPct: number | null }` keyed by listing ID; `ScoutMap` accepts `listings`, `selectedListingId`, `onListingClick`, and optional selected parcel GeoJSON in addition to coordinate picking.
- Preserves: `GET /api/listings` existing camelCase fields and filters, adding only `latitude`, `longitude`, and `yieldAt85OccPct`.

- [ ] **Step 1: Add RED contract coverage**

  Add root `pnpm test:signature-views`. Assert the listings route uses server-side `ST_Y/ST_X` and latest owned feasibility data, Scout exposes the six settled filters (`All`, `RES2`, `RES3`, `RES4`, `Low dolomite`, `Score ≥ 80`), lead cards contain score/address/facts/tags/open action, MapLibre is a pinned package rather than CDN code, and the map has listing marker, floating lead chip, legend, and fallback contracts. Run it and preserve the first real failure.

- [ ] **Step 2: Extend the authenticated listing read model**

  Implement one parameterized helper that reads coordinates with `ST_Y(coordinates::geometry)` / `ST_X(...)` and the latest report's `yield_at_85_occ_pct` for listing IDs owned by the authenticated actor. Merge summaries into the existing Drizzle rows; do not weaken ownership filters or serialize geography internals.

- [ ] **Step 3: Recompose Scout around cards and synchronized filters**

  Implement search plus the six handoff filter tabs over one derived array. Render responsive lead cards with a score ring, address/suburb, size, exact price and price/m², zoning/dolomite tags, optional saved yield, and an Open action. Pass the same filtered coordinate-bearing leads to the map so list and overlay never disagree.

- [ ] **Step 4: Package and extend MapLibre**

  Install/import pinned `maplibre-gl@4.7.1` and its CSS, remove CDN script/link injection, render accessible custom score markers, recenter on selected leads, retain coordinate picking, and add the handoff floating lead chip plus score/zone/dolomite legend. On map/style failure render a themed fallback while leaving cards/manual coordinate analysis usable.

- [ ] **Step 5: Verify, report, and commit**

  Run signature smoke, UI-foundation smoke, typecheck, lint, placeholder build, authenticated listing/API workflow checks, and an authenticated browser probe at desktop/320px proving filters, cards, marker count, map fallback, containment, and dark mode. Write `.superpowers/sdd/task-6a-report.md`, clean fixtures, and commit without audits.

### Task 2: Parcel facts, selected map, and interactive massing

**Files:**
- Create: `apps/web/app/scout/[id]/_components/ParcelIntelligence.tsx`
- Create: `apps/web/app/scout/[id]/_components/Massing3D.tsx`
- Modify: `apps/web/app/scout/[id]/page.tsx`
- Modify: `apps/web/app/scout/_components/ScoutMap.tsx`
- Modify: `apps/web/lib/listing-spatial.ts`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json`
- Modify: `scripts/signature-views-smoke.ts`

**Interfaces:**
- Consumes: owned listing coordinates and `ParcelAnalysis` from `/api/parcel`.
- Produces: `Massing3DProps { erfSqm; maxFootprintSqm; maxBuildableSqm; storeys; unitCount }`; selected parcel map accepts valid Polygon/MultiPolygon GeoJSON and ignores malformed geometry safely.

- [ ] **Step 1: Extend RED coverage**

  Assert linked Parcel Detail automatically loads live spatial analysis, exposes the handoff fact chips and zoning/dolomite tags, renders selected parcel map plus legend, and mounts a Three.js massing canvas with orbit controls, footprint/storey derivation, dashed building line, animation, resize handling, reduced-motion behavior, WebGL fallback, and cleanup. Run and preserve the real failure.

- [ ] **Step 2: Resolve coordinates without weakening ownership**

  Reuse the parameterized spatial helper in the server page. Pass only the owned listing's coordinate/address/size/price metadata to the client intelligence panel. Keep `LinkParcelForm` as the no-coordinate recovery path and keep Viewer mutation hiding/handler denial intact.

- [ ] **Step 3: Render live parcel facts and selected map**

  Fetch `/api/parcel` on mount for valid coordinates, show loading/error/degraded states, and render erf size, price, price/m², zone, coverage, FAR, storeys, max footprint/buildable/units, dolomite, amenity scores, forms, and the Evaluate/Compliance actions. Reuse `ScoutMap` in selected-parcel mode with boundary fill/line and one selected marker.

- [ ] **Step 4: Implement isolated Three.js massing**

  Install `three@0.160.0` and `@types/three@0.160.0`. Create a scene, orthographic or perspective camera, ground parcel, dashed building line using error maroon `#A5132A` (never C-mark red `#E61414`), simplified building volume sized from footprint/buildable/storeys, lights, labels/overlay, and OrbitControls. Animate scale-in unless reduced motion is requested; on unmount cancel frames, dispose controls/geometries/materials/renderer, and remove listeners/canvas. Render a themed static fallback when WebGL initialization fails.

- [ ] **Step 5: Verify, report, and commit**

  Run focused/static gates plus an authenticated linked/unlinked browser sequence at desktop/320px and dark/light, asserting facts, selected boundary/marker, canvas/fallback, controls, no overflow, no console errors, and cleanup. Run auth-role/API workflow/worker tests, write `.superpowers/sdd/task-6b-report.md`, clean data, and commit without audits.

### Task 3: Cost Oracle bars and signature-view completion

**Files:**
- Create: `apps/web/app/evaluate/result/_components/CostBreakdownBars.tsx`
- Modify: `apps/web/app/evaluate/result/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `scripts/signature-views-smoke.ts`
- Modify: `tasks/todo.md`
- Create: `.superpowers/sdd/task-6c-report.md`

**Interfaces:**
- Consumes: trusted result costs `costLand`, `costBuild`, `costProfessionalFees`, `costBulkContributions`, `costTransferDuty`, and `costTotal`.
- Produces: pure proportional bar rows using `width = costTotal > 0 ? clamp(cost / costTotal * 100, 0, 100) : 0`; no recalculation or persistence.

- [ ] **Step 1: Add RED result-view assertions**

  Require the four signature KPI cards (total investment, gross annual income, yield at 100%, yield at 85%), analysis-subject card, five labelled proportional bars with exact money, total/verdict/evidence treatment, responsive/dark semantic classes, and unchanged trusted save/create-project payload. Run and preserve the first failure.

- [ ] **Step 2: Build the pure bar component and recompose result**

  Render accessible labelled progress semantics with deterministic colors/tokens, exact values and percentage widths. Recompose the page to match the handoff hierarchy while retaining degraded zoning evidence, actual/target units, viability notes, save, create-project, and new-analysis behavior. Do not add a fake Export report action; canonical report export belongs to the PDF task.

- [ ] **Step 3: Complete verification and independent review package**

  Run signature/UI smokes, typecheck, lint, build, auth-role, API workflow, worker 40 tests, scoped diff/C-mark comparison, and authenticated desktop/320/dark browser probes for all three views. Update `tasks/todo.md` only when the signature-view slice is proven, write `.superpowers/sdd/task-6c-report.md`, self-review the full Task 6 diff, and commit without pushing or audits.
