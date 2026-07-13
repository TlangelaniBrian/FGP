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

- The worker retains the existing tariff fallback strategy when a requested
  year's DB rows are missing or the DB is unavailable. This preserves service
  availability but means operators must publish complete year-specific tariffs
  for authoritative non-2026 calculations.
- Redis was unavailable during local smoke runs, so worker rate limiting used
  its existing in-memory fallback.
- Next.js still reports the pre-existing multiple-lockfile, middleware naming,
  and Node `module.register()` deprecation warnings; none failed the build.
