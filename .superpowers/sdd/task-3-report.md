# Task 3 report: trusted feasibility decisions and tariff completeness

## Outcome

Implementation commit: `2829d6c` (`fix(feasibility): trust server-owned decisions`).

Every saved feasibility report now accepts only canonical analysis inputs,
re-runs the shared server-to-worker calculation path, validates the worker
response, and atomically inserts the listing/report from server-owned outputs.
Caller-provided decisions, costs, yields, scores, capacity, risk, and notes are
rejected by the strict input contract and cannot be persisted.

## RED evidence

### Worker RED

Command:

```bash
cd apps/worker
PYTHONPATH=. .venv/bin/pytest -q tests/test_calculations.py tests/test_feasibility_endpoint.py tests/test_tariffs.py
```

Result before production edits: `6 failed, 17 passed`.

The failures were specific to the requested missing behavior:

- `KeyError: 'luxury'` for unit-size/rent defaults.
- missing `capacity` response contract.
- exposed sentinel-based capacity rather than nullable density.
- missing zoning raised `AttributeError` instead of returning a degraded result.
- the worker rejected `unit_type="luxury"` with HTTP 422.
- the endpoint did not return the selected tariff year.

### Authenticated integration RED

Command:

```bash
FGP_SITE_URL=http://127.0.0.1:3001 node scripts/api-workflow-smoke.mjs
```

The authenticated Owner workflow failed because a negative `build_rates`
payload returned HTTP 200 and was persisted instead of returning 422. The local
test row was immediately restored to the exact 2026 baseline and verified.
Baseline source inspection also confirmed that the legacy camelCase save
contract inserted caller-supplied `viable`, costs, yields, scores, capacity,
risk, and notes directly. The final regression sends both canonical extra
output fields and the complete legacy forged contract; both must return 422 and
must leave no listing behind.

## Exact contracts

### Canonical analysis/save request

Both `POST /api/feasibility` and `POST /api/feasibility/save` use the same strict
Zod object:

```text
address: string (1..500)
municipality: johannesburg | tshwane | ekurhuleni
zone_code: alphanumeric, underscore, or hyphen (1..20)
size_sqm: number (100..1,000,000)
price: number (10,000..500,000,000)
unit_type: bachelor | 1bed | 2bed | luxury
target_units: integer (1..200)
tariff_year: integer (2024..2030)
```

Unknown keys are rejected. The shared server helper loads the municipality and
zone rule, calls `/analyze/feasibility`, and validates the complete worker
response before either route can return or persist it.

### Capacity and evidence response

The worker now returns:

```text
decision_status: definitive | degraded
zoning_evidence_available: boolean
tariff_year: integer
build_rate_per_sqm: positive number
max_units_allowed: integer | null
capacity.density_units: integer | null
capacity.far_units: integer | null
capacity.footprint_storey_units: integer | null
max_footprint_sqm: number | null
max_buildable_sqm: number | null
```

`actual_units` is constrained by every available limit: per-erf, per-hectare,
FAR floor area divided by unit size, and footprint multiplied by storeys divided
by unit size. Unknown density is `null`, never `9999`. If zoning evidence is
missing, no generic envelope is asserted, the decision is `degraded`, and
`viable` is forced to `false` with an explanatory note.

### Tariff writes

`PUT /api/tariffs` accepts years 2024–2030 and a discriminated, strict schema per
category. Build rates, unit sizes, market rents, and bulk ranges must be positive
and contain only the four supported unit types. Bulk data must contain only the
three supported municipalities and each minimum must not exceed its maximum.
Professional fees must be greater than zero and no more than 30%. Transfer-duty
brackets require increasing upper bounds, ordered cumulative bases, valid rates,
and a single unbounded final bracket. Validation failures return 422 before the
upsert.

## Migration and schema impact

No database migration is required. Existing nullable report columns already
represent unknown capacity/envelope values. The 2026 seed data and worker
fallback/DB merge now include luxury unit size (`120 m²`), rent (`R18,000`),
build rate (`R18,500/m²`), and municipality-specific bulk ranges.

## Files changed

- Shared Next.js contract/calculation helper and both feasibility routes.
- Tariff API semantic validation.
- Evaluate form, result save payload, Zustand types, and tariff-year controls.
- Worker feasibility request/response, calculations, and tariff defaults/parser.
- Tariff seed fixture.
- Worker calculation/endpoint/tariff tests.
- Authenticated workflow regression fixture.
- Task checklist and local tooling-error learning.

## GREEN evidence

- Focused worker tests: `23 passed`.
- Full worker suite: `35 passed in 0.77s`.
- Authenticated workflow smoke: passed, including canonical save, both forged
  contract rejections, invalid tariff non-persistence, and cleanup.
- Authenticated role smoke: passed, including RLS, Viewer boundaries, stable
  approval IDs, and cleanup.
- Web TypeScript: passed (`pnpm --filter web typecheck`).
- Web ESLint: passed (`pnpm --filter web lint`).
- Web production build: passed (`pnpm --filter web build`, 26/26 pages).
- Ruff on touched worker files: passed.
- Pyright on touched worker production files: `0 errors, 0 warnings`.
- `git diff --check`: passed.

## Self-review

- Confirmed analyze and save import the same strict schema and calculation
  helper; no financial calculation rule was added to the browser.
- Confirmed save computes before a transaction and only trusted response fields
  reach listing/report inserts.
- Confirmed role guards and owner IDs are unchanged.
- Confirmed missing zoning cannot produce `viable=true` and no sentinel capacity
  is returned.
- Confirmed tariff validation happens before storage and workflow assertions
  compare the tariff row before/after invalid input.
- Confirmed pre-existing `.superpowers/audits/` artifacts were not staged or
  modified.

## Concerns

- The worker retains hard-coded tariff fallback only for its matching 2026
  vintage. Operators must publish complete, valid database bundles before any
  other year can be analyzed or saved.
- Redis was unavailable during local smoke runs, so worker rate limiting used
  its existing in-memory fallback.
- Next.js still reports the pre-existing multiple-lockfile, middleware naming,
  and Node `module.register()` deprecation warnings; none failed the build.

## Independent review remediation

Implementation commit: `2e8d478` (`fix(feasibility): persist trusted decision evidence`).

All findings in `task-3-review.md` were addressed under TDD:

- Hard-coded fallback is now valid only for tariff year 2026. Missing, partial,
  or invalid bundles for 2024–2025 and 2027–2030 return a clear worker HTTP 422;
  save relays the validation outcome and inserts no listing or report.
- Zoning evidence is derived from usable capacity constraints, so an existing
  row with all-null coverage, FAR, storeys, and density fields is degraded and
  can never return `viable=true`.
- `CapacityResponse` is an explicit Pydantic model requiring the same density,
  FAR, and footprint/storey components as the Next response validator.
- Migration `0017_feasibility_decision_evidence.sql` adds and backfills
  `actual_units`, `decision_status`, `zoning_evidence_available`, and the three
  typed capacity components. Legacy rows are conservatively marked degraded;
  new saves persist the trusted worker values atomically with their costs.

Review-remediation RED evidence:

- Focused worker baseline: `5 failed, 22 passed` for tariff relabeling/partial
  bundles, all-null zoning, missing endpoint rejection, and missing Pydantic
  capacity typing.
- Authenticated workflow baseline failed with PostgREST `42703` because
  `feasibility_reports.actual_units` did not exist.

Review-remediation GREEN evidence:

- Focused worker: `27 passed`.
- Full worker: `39 passed in 0.73s`.
- Local migration application: passed through migration 0017.
- Authenticated workflow smoke: passed with explicit 120-second timeout; stored
  target/actual units `8/5`, capacity `5/19/23`, definitive/evidence flags, and
  five-unit build cost all matched. Missing 2030 tariffs returned 422 and left
  no listing.
- Authenticated role smoke: passed with explicit 120-second timeout.
- Web typecheck, ESLint, and production build: passed (26/26 pages).
- Ruff: passed. Pyright: `0 errors, 0 warnings`. `git diff --check`: passed.

Review self-check confirmed the migration backfill is conservative, all new
report evidence comes only from the validated worker response, non-2026 bundles
cannot reach the fallback, temporary zoning fixtures reconcile and clean up,
and the pre-existing `.superpowers/audits/` directory remains untouched.

## Decimal tariff precision follow-up

Implementation commit: `0c7e001` (`fix(tariffs): preserve decimal precision`).

The final review finding was reproduced with a focused RED assertion: a JSONB
build rate of `14200.25` emerged from worker parsing as `14200`. Tariff value
maps are now typed and parsed as floats for build rates, unit sizes, and market
rents, matching the Next Zod contract that accepts positive decimal numbers.
No integer coercion remains in the DB-row parsing path.

Round-trip coverage now writes a complete decimal 2029 bundle through
`PUT /api/tariffs`, reads the JSONB rows through the worker, and verifies exact
`build_rate_per_sqm=14200.25`, `rent_per_unit_monthly=6500.75`, and build cost
from `55.25 m²` units after normal two-decimal monetary rounding. The workflow
snapshots and restores any prior 2029 rows; the local post-run state was verified
empty.

Precision follow-up GREEN evidence:

- Focused decimal regression: `1 passed`.
- Full worker suite: `40 passed in 0.64s`.
- Authenticated workflow and role smokes: passed with 120-second limits.
- Web typecheck, ESLint, and production build: passed (26/26 pages).
- Ruff passed; Pyright reported `0 errors, 0 warnings`; `git diff --check` passed.

No schema migration was needed because tariff payloads are JSONB and feasibility
monetary report columns are already numeric. Existing integer tariff values
remain valid and compare identically as floats.
