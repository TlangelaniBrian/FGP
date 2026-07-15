# Task 6B report — parcel intelligence and parametric massing

## Status

DONE

Task 6B now turns an actor-owned linked listing into the Parcel Detail signature
view: live PostGIS parcel facts, a validated selected boundary and one selected
map marker, zoning/dolomite/forms/amenity evidence, and an isolated interactive
Three.js massing preview. Unlinked listings retain the coordinate recovery path,
while Viewer mutation UI remains server-hidden and the existing handler denial
remains unchanged.

## TDD evidence

Before production edits, `scripts/signature-views-smoke.ts` was extended and the
first real `pnpm test:signature-views` run exited 1 at the expected package
boundary:

```text
AssertionError [ERR_ASSERTION]: Three.js must be pinned exactly to 0.160.0
+ actual - expected
+ undefined
- '0.160.0'
```

Self-review later found that the initial mesh scale could flash at 1 before the
first animation frame. A focused regression assertion was added and captured a
second genuine RED before the correction:

```text
AssertionError [ERR_ASSERTION]: Massing3D is missing
/building\.scale\.setScalar\(reducedMotion\s*\?\s*1\s*:\s*0\)/
```

The final focused smoke passes with executable Polygon/MultiPolygon acceptance,
malformed/unclosed/non-finite geometry rejection, coordinate bounds, package,
ownership, abort/stale-response, map lifecycle, massing lifecycle, accessibility,
reduced-motion, fallback, C-mark exclusion and responsive contracts.

## Implementation

- Reused `getListingSpatialSummaries(actor.userId, [listing.id])` after the
  existing actor-owned listing lookup. The client receives only that owned
  listing's ID, validated coordinate, address/suburb, size and price metadata;
  raw geography and browser-supplied coordinates are never trusted.
- Added strict Gauteng coordinate validation and a pure selected-geometry parser.
  It accepts only finite, globally valid, closed-ring Polygon/MultiPolygon
  geometry and safely returns `null` for malformed worker data.
- Added automatic `/api/parcel` loading with `AbortController`, the fetch signal,
  active-request and sequence guards, and explicit loading, worker error,
  no-match and boundary-degraded states.
- Recreated the handoff hierarchy with exact ZAR facts, zone and dolomite tags,
  coverage/FAR/storeys/footprint/buildable/units, derived potential, amenity
  scores, required forms, and Evaluate/Compliance actions.
- Hardened selected-parcel MapLibre ownership: valid geometry only, remove-before-
  add, deterministic fill/line/source teardown, a selected-boundary runtime
  marker, one accessible selected listing marker and no duplicate coordinate
  marker.
- Pinned `three@0.160.0` and `@types/three@0.160.0`. `Massing3D` creates a real
  scene, camera, parcel ground, maroon `#A5132A` dashed boundary, derived building
  volume/floor lines, lights and OrbitControls. It starts at scale zero unless
  reduced motion is requested, observes resize, renders on orbit, and disposes
  frames, observers, listeners, controls, geometry, materials, renderer and
  canvas on teardown.
- WebGL construction failures render a themed static status without hiding the
  text facts or selected map. The massing has a descriptive image label and its
  implementation contains no C-mark red `#E61414`.
- The unlinked recovery state retains exact listing facts and LinkParcelForm for
  write-capable actors. Viewer receives a read-only notice and no form, inputs or
  Link action; `POST /api/listings/:id/link-parcel` still denies Viewer directly.
- Added semantic light/dark styling, 860px stacking and explicit 320px containment.

## Verification

| Gate | Result |
|---|---|
| `pnpm test:signature-views` | PASS |
| `pnpm test:ui-foundation` | PASS |
| `pnpm --filter web typecheck` | PASS |
| `pnpm --filter web lint` | PASS |
| production-env `pnpm --filter web build` | PASS — 26/26 pages |
| `apps/worker/.venv/bin/python -m pytest tests` from `apps/worker` | PASS — 40/40 |
| authenticated `pnpm test:api:workflow` on exact 3001/8001 | PASS with cleanup |
| authenticated `pnpm test:auth-roles` on exact 3001 | PASS with cleanup |
| scoped `git diff --check` | PASS |

The first build probe compiled and typechecked but correctly stopped at missing
`DATABASE_URL`; the local Supabase `DB_URL` was then mapped privately and the
full build passed. Expected workspace-root, middleware-convention and Node
`module.register()` warnings remain unchanged.

## Authenticated browser verification

Fresh processes were started from this worktree and listener CWDs were verified:

- `127.0.0.1:3001` → `apps/web`
- `127.0.0.1:8001` → `apps/worker`

An isolated Owner/Viewer fixture with a real PostGIS parcel, zoning polygon,
scheme rule and dolomite polygon proved:

- Linked Owner, 1440px dark and light: exact `1 024 m²`, `R 980 000.00`,
  `R 957.03`, `60%`, FAR `1.5`, 3 storeys, `614 m²` footprint,
  `1 536 m²` buildable and 12 units; required forms and actions present.
- Linked map: `data-selected-parcel="true"`, selected-boundary legend, one
  listing marker, zero coordinate markers and one MapLibre canvas.
- Linked massing: one Three canvas, zero fallbacks and a descriptive image label.
- Linked 320px light and dark: document `clientWidth === scrollWidth === 320`;
  detail/map x=16..304 (288px), massing x=31..289 (258px), and all fact cards
  contained.
- Unlinked Owner, desktop/320 and light/dark: canonical facts, two coordinate
  inputs and one Link action, no live-intelligence component and no overflow.
- Unlinked Viewer, desktop/320 and light/dark: read-only banner/notice, zero forms,
  zero inputs and zero Link actions, with the notice contained at 320px.
- Controlled WebGL construction failure: one themed fallback, zero Three canvases,
  while all 12 facts and the selected map remained. After immediate source
  restoration the normal route returned to one canvas and zero fallbacks.
- Navigating from linked to unlinked left zero Three and zero MapLibre canvases,
  exercising component teardown. Final app-origin console errors: zero. The only
  browser errors came from an unrelated Chrome extension.

All fixture listings, spatial rows, scheme rule, team rows and auth users were
removed; the fixture state/script and controlled fault were removed; browser
viewport/tabs were finalized; and both 3001/8001 processes were stopped and
absence-checked.

## Independent review correction — degraded owned facts

The independent review RED identified that both the worker-error and
`{ found: false }` branches returned before the trusted actor-owned facts were
rendered. The correction isolates an executable view-state/fact builder and
renders its address/suburb, land size, exact price and derived price/m² beneath
both degraded banners.

The new executable assertion was proved RED by temporarily forcing
`showOwnedFacts: false`; `pnpm test:signature-views` exited 1 with the exact
regression signal:

```text
AssertionError [ERR_ASSERTION]: Non-2xx/error mode must retain actor-owned listing facts
false !== true
```

After restoring the production predicate (`mode !== "loading"`), the same
command exited 0:

```text
Signature property views contract smoke passed
```

Fresh correction gates were GREEN:

- `pnpm test:signature-views` — PASS.
- `pnpm test:ui-foundation` — PASS.
- `pnpm --filter web typecheck` — PASS.
- `pnpm --filter web lint` — PASS.
- production-environment `pnpm --filter web build` — PASS, 26/26 pages.
- `apps/worker/.venv/bin/python -m pytest tests` — PASS, 40/40.
- authenticated `pnpm test:api:workflow` on exact 3001/8001 — PASS with cleanup.
- authenticated `pnpm test:auth-roles` on exact 3001 — PASS with cleanup.
- `git diff --check` — PASS.

Production runtime listener ownership was rechecked before browser evidence:
3001 resolved to this worktree's `apps/web`, and 8001 resolved to this
worktree's `apps/worker`. A real authenticated Owner fixture then proved both
controlled degraded branches in dark mode at 1440×1000 and 320×900:

- Worker unavailable: the `Live parcel intelligence is unavailable` alert and
  `Worker unreachable — is the FastAPI service running?` message remained with
  `Fallback facts parcel · Edge Gauteng`, `1 024 m²`, `R 980 000.00`, and
  `R 957.03`.
- Worker `{ found: false }`: the `No mapped parcel found` status remained with
  the same four exact owned facts.
- Both branches had `documentElement.clientWidth === scrollWidth` at 1440 and
  320; the 320px degraded root was contained at x=16..304 and each fact at
  x=31..289.
- App-origin console errors were zero. Chrome emitted only an unrelated
  extension error.

After restoring the worker and adding a uniquely marked PostGIS parcel/zoning/
rule/dolomite fixture around the same owned coordinate, the ready view returned
with no degraded banner, zone `T6B251`, 60% coverage, FAR 1.5, 3 storeys,
614 m² footprint, 1 536 m² buildable, 12 units, one selected parcel, one
MapLibre canvas, one Three.js `massing-canvas`, zero massing fallbacks, no
overflow at 1440/320, and zero app-origin console errors.

Cleanup was re-proved: all four marked spatial fixture counts were zero, the
fixture listing/team/auth user and fixture JSON were removed, the temporary
`scripts/task6b-review-fixture.py` was deleted, the browser viewport was reset
and its temporary tab finalized, and listeners on 3001/8001 were stopped.

## Concerns

None blocking. Map tiles remain a network dependency and WebGL availability
varies by browser/device; both now have verified themed degradation paths that
preserve the decision facts and actions.
