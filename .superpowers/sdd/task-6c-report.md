# Task 6C report — Cost Oracle bars and signature-view completion

## Status

DONE

Task 6C completes the three-view signature slice with a pure proportional cost
breakdown and a faithful Cost Oracle hierarchy. It does not recalculate or
persist costs, change either mutation payload, or add the handoff's placeholder
export action.

## TDD evidence

Before any production edit, `scripts/signature-views-smoke.ts` was extended with
executable cost-row edge cases and result-page source contracts. The first real
run exited 1 at the expected missing-component boundary:

```text
$ pnpm test:signature-views
AssertionError [ERR_ASSERTION]: Cost Oracle must expose the pure CostBreakdownBars component
```

The final smoke imports and executes the production row builder. It proves:

- `costTotal <= 0` produces five zero-width bars;
- zero and negative costs clamp to `0%` without changing their displayed money;
- an over-total cost clamps to `100%`;
- ordinary costs use `cost / costTotal * 100`;
- every value remains exact `formatZar` output;
- all five tracks expose labelled progressbar semantics with min `0`, max `100`
  and the computed percentage as `aria-valuenow`.

The same smoke also fixes the result hierarchy, responsive/theme classes,
prescribed 200ms portal easing and reduced-motion override, canonical save input,
saved listing/report IDs plus trusted project total, and absence of a fake
`Export report` action.

## Implementation

- Added `CostBreakdownBars` with a pure exported `buildCostBreakdownRows` helper,
  five deterministic semantic tones, exact money, and accessible progress
  tracks. It consumes only the trusted result costs and never mutates them.
- Rebuilt the result page around the settled analysis-subject card, four KPI
  cards, two-column breakdown/income/decision treatment, exact total, and the
  evidence-aware verdict.
- Retained actual/target units, rezoning evidence, `decisionStatus`,
  `zoningEvidenceAvailable`, dolomite risk, score, and `viabilityNotes`.
- Preserved `body: JSON.stringify(formValues)` for canonical trusted save and
  the existing saved listing/report IDs, trimmed project name, and trusted
  `costTotal` for project creation.
- Preserved Owner/role-gated save, create-project, project link, edit-inputs and
  new-analysis behavior. Canonical PDF export remains for the later PDF task.
- Added theme-token styling, 860px stacking, explicit 320px containment, tabular
  money, the 200ms portal motion curve, and the global reduced-motion shutdown.

## Verification

| Gate | Result |
|---|---|
| `pnpm test:signature-views` | PASS — executable bar edge cases and full three-view contract |
| `pnpm test:ui-foundation` | PASS |
| `pnpm --filter web typecheck` | PASS |
| `pnpm --filter web lint` | PASS |
| production-environment `pnpm --filter web build` | PASS — 26/26 pages |
| `.venv/bin/python -m pytest tests` from `apps/worker` | PASS — 40/40 |
| authenticated `pnpm test:api:workflow` on exact 3001/8001 | PASS with cleanup |
| authenticated `pnpm test:auth-roles` on exact 3001 | PASS with cleanup |
| `git diff --check` | PASS |
| full Task 6 C-mark scan from `8abfbb3` | PASS — no production addition of `#E61414` |

The first production build compiled and typechecked, then correctly stopped at
missing Supabase public variables in the isolated worktree. A fresh rerun with
the live local Supabase values injected only into the process environment passed
all 26 pages. Established multiple-lockfile, middleware-convention and Node
`module.register()` warnings remain unchanged.

## Authenticated browser verification

Fresh listeners were started and their CWDs were verified before any probe:

- `127.0.0.1:3001` → this worktree's `apps/web`;
- `127.0.0.1:8001` → this worktree's `apps/worker`.

An isolated authenticated Owner fixture with a coordinate-bearing listing and
live parcel/zoning/dolomite geometry proved all three dark-mode views:

- Scout at 1440px: one exact `R 980 000.00` lead card, one synchronized listing
  marker, one MapLibre canvas, no fallback and `clientWidth === scrollWidth`.
- Parcel at 1440px: 12 facts, one selected parcel, one MapLibre canvas, one
  Three.js massing canvas, no fallback, and exact price/size/zoning evidence.
- Cost Oracle at 1440px: four KPI cards, five progressbars with exact accessible
  money names and proportional widths, exact total, analysis subject, degraded
  zoning evidence treatment, visible trusted actions, and zero fake exports.
- At 320px Scout card/map, Parcel root/map/massing, Cost subject and every KPI
  remained within x=16..304 (the inset massing stayed x=31..289); all three had
  `clientWidth === scrollWidth === 320` and `data-mode="dark"`.
- App-origin console errors were zero. The only errors were emitted by an
  unrelated Chrome extension.

The fixture auth user, member, listing and all marked spatial rows were removed
and absence-checked. Temporary fixture scripts and browser tab were removed, the
viewport override was reset, and both 3001/8001 listeners were stopped and
absence-checked.

## Full Task 6 self-review

Reviewed the complete Task 6 diff from plan commit `8abfbb3`, including Scout
ownership/filter/marker contracts, Parcel geometry/degraded facts/map/massing
lifecycle, and Cost trusted result/save/project contracts. No blocking finding
remains. The C-mark comparison found no production use of reserved red; Task 6C
uses semantic theme tokens and maroon `#A5132A` only for danger treatment.

## Concerns

None blocking. Map tiles and WebGL remain runtime dependencies with the already
verified Task 6A/6B degradation paths. Cost Oracle deliberately omits report
export until the canonical PDF task supplies a real action.
