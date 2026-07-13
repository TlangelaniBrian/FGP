# Task 6A report — persisted Scout signature view

## Status

DONE

Task 6A now renders actor-owned persisted leads as signature Scout cards and
keeps the card list and MapLibre overlays synchronized through one derived
filtered array. No authentication, role, mutation, or ownership contract was
weakened.

## TDD evidence

Before any production change, the root `test:signature-views` command and
`scripts/signature-views-smoke.ts` were added and run.

The first real run exited 1 at the expected missing-feature boundary:

```text
$ pnpm test:signature-views
AssertionError [ERR_ASSERTION]: MapLibre must be pinned exactly to 4.7.1
+ actual - expected
+ undefined
- '4.7.1'
```

After implementation, the same command prints:

```text
Signature property views contract smoke passed
```

## Implementation

- Added one parameterized `getListingSpatialSummaries(actorUserId, listingIds)`
  helper. It sanitizes and de-duplicates IDs, scopes both the listing and
  lateral report read to the authenticated actor, derives latitude/longitude
  with `ST_Y`/`ST_X`, and orders reports by `created_at DESC NULLS LAST, id DESC`.
- Preserved `GET /api/listings` actor ownership plus `id`, `q`, and `status`
  filters. The response retains the existing camelCase row and adds only
  `latitude`, `longitude`, and `yieldAt85OccPct`. Raw geography is absent from
  the Drizzle listing model and never selected or serialized.
- Rebuilt Scout with the settled `All`, `RES2`, `RES3`, `RES4`, `Low dolomite`,
  and `Score ≥ 80` filters, search, loading/error/empty states, exact ZAR values,
  score rings, facts, tags, optional saved yield, and Open actions.
- Derived `filteredListings` once and derived coordinate-bearing `mapListings`
  only from it, so cards and markers cannot disagree.
- Replaced CDN injection with exact `maplibre-gl@4.7.1` package/CSS imports.
  Added accessible score markers, selected-lead recentering, marker/map/source
  cleanup, coordinate picking, optional selected parcel GeoJSON, floating lead
  chip, legend, themed fallback, dark-map treatment, 860px stacking, and 320px
  containment.

## Verification

| Gate | Result |
|---|---|
| `pnpm test:signature-views` | PASS |
| `pnpm test:ui-foundation` | PASS |
| `pnpm --filter web typecheck` | PASS |
| `pnpm --filter web lint` | PASS |
| placeholder `pnpm --filter web build` | PASS — 26/26 pages |
| `pnpm test:api:workflow` against `127.0.0.1:3001` | PASS with cleanup |
| `pnpm test:auth-roles` against `127.0.0.1:3001` | PASS with cleanup |
| scoped `git diff --check` | PASS |

The build emitted only the established multiple-lockfile,
middleware-convention, and Node `module.register()` deprecation warnings.

## Authenticated API probe

The active process CWDs were verified before probing:

- web `127.0.0.1:3001` → this worktree's `apps/web`
- worker `127.0.0.1:8001` → this worktree's `apps/worker`

An isolated owner/intruder fixture proved:

- existing `id`, `q`, and `status` filters still compose with owner scope;
- coordinates were returned as `latitude: -25.974` and `longitude: 28.126`;
- the latest owner report yielded `14.2`, despite a later intruder-owned report
  for the same listing containing `99.9`;
- the intruder's listing was absent from the owner's unfiltered response;
- neither `coordinates` nor snake_case yield fields leaked.

## Authenticated browser probe

Chrome signed in through the real `/login` flow and opened `/scout` on port
3001.

- Desktop 1710px dark mode: 3 cards, 3 DOM listing markers, all six filter
  labels, exact money/yield text, floating chip/legend, and
  `clientWidth === scrollWidth === 1710`.
- RES2 filter: synchronized 1 card, 1 marker, `1 of 3 listings`.
- 320px dark mode: 3 cards, 3 markers, one 288px column; each card measured
  `left: 16`, `right: 304`; `clientWidth === scrollWidth === 320`.
- Controlled style failure: themed fallback appeared while all 3 cards, both
  manual coordinate inputs, and the enabled Analyse action remained usable at
  320px. The fault was removed immediately and never staged.
- Fresh restored tab: 3 cards, 3 markers, zero fallbacks, and zero app-origin
  console errors. One unrelated Chrome extension error was observed.

All fixture listings, reports, team rows, auth users, temporary state/scripts,
and browser tabs were removed. The production MapLibre URLs were restored and
rechecked before final gates.

## Concerns

None blocking. The raster basemap remains a network dependency; the verified
fallback intentionally preserves cards, filters, and manual coordinate
analysis when it is unavailable.

## Independent review fix — RED to GREEN (14 July 2026)

### RED evidence

The independent review reproduced two runtime failures on the authenticated
3001 Scout view:

- selecting the RES3 lead and then filtering to RES2 left a stale
  `.coordinate-marker` for the filtered-out lead, so one card disagreed with
  two visible map overlays;
- MapLibre replaced every pre-construction marker label with `Map marker`, and
  listing selection created a second coordinate marker whose centre won
  `document.elementFromPoint()` over the actionable listing marker.

### Fix

- Added executable pure selection transitions in `scout-selection.ts` so a
  listing selection and an intentional analysis coordinate are mutually
  exclusive. Filtering reconciles a hidden listing to the empty selection,
  while a manual/map-picked coordinate survives unrelated filters.
- Added executable marker helpers in `scout-marker.ts`. Listing labels are
  restored after `Marker.addTo()` (the point where MapLibre overwrites them),
  include listing ID, location, and score, and remain unique. Coordinate
  markers are explicitly presentational and non-interactive.
- Extended the signature smoke with executable selection and simulated
  post-MapLibre accessibility assertions, rather than source-string checks
  alone. No ownership, API, persistence, or map package contract changed.

### GREEN evidence

Fresh final source and runtime gates:

| Gate | Result |
|---|---|
| `pnpm test:signature-views` | PASS — executable selection and marker contracts |
| `pnpm test:ui-foundation` | PASS |
| `pnpm --filter web typecheck` | PASS |
| `pnpm --filter web lint` | PASS |
| production-env `pnpm --filter web build` | PASS — 26/26 static pages |
| `apps/worker/.venv/bin/python -m pytest tests` from `apps/worker` | PASS — 40/40 |
| authenticated `pnpm test:api:workflow` on `127.0.0.1:3001` / worker `8001` | PASS with cleanup |
| authenticated `pnpm test:auth-roles` on `127.0.0.1:3001` | PASS with cleanup |
| scoped `git diff --check` | PASS |

The first build probe correctly stopped at missing `DATABASE_URL`; the rerun
mapped the live local Supabase `DB_URL` and passed. The first worker probes used
the pytest console entry point, which did not place `apps/worker` on the import
path; the project-correct `python -m pytest` invocation passed all 40 tests.

### Authenticated browser regression

The web and worker listener CWDs were re-confirmed as this validation worktree
before a new Owner fixture signed in through the real `/login` form.

- Baseline: 3 cards, 3 listing markers, and 3 unique descriptive names.
- Listing selection: 0 coordinate markers; the selected marker label was
  `Select listing 230: ERF 1247 · Noordwyk, Midrand; feasibility score 92 out of 100`;
  `elementFromPoint()` at its centre returned that listing button.
- Select RES3, then filter RES2: exactly 1 card, 1 listing marker (RES2),
  0 coordinate markers, `1 of 3 listings`, and no retained selection.
- Select RES2, then submit `-25.985000, 28.128000`: listing selection cleared;
  exactly 1 coordinate marker remained with `aria-hidden="true"`,
  `role="presentation"`, no label/tab index, and `pointer-events: none`.
- 320px dark mode: three 288px cards at x=16..304, a 288px map,
  `clientWidth === scrollWidth === 320`, and `data-mode="dark"`.
- Controlled tile failure at 320px: one themed fallback, three usable cards,
  and enabled latitude, longitude, and Analyse controls. The exact three CARTO
  URLs were restored immediately; the refreshed view returned to 3 cards,
  3 listing markers, and 0 fallbacks.
- No app-origin console errors were present. The only browser errors were from
  an unrelated Chrome extension.

The isolated activity, reports, listings, team row, and auth user were deleted
and absence-checked. The temporary viewport override and browser tab were
cleaned up. No new web or worker process was started during this fix review.
