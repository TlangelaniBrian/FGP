# Task 5D Report: Responsive grids, exact money consumers, and motion

Date: 2026-07-13
Branch: `pull-new-designs`
Checkout: `/private/tmp/fgp-pull-new-designs-validation.CtdZIq`

## Scope

- Added deterministic source assertions for `.portal-grid-2`, `.portal-grid-3`, and `.portal-grid-4`, their exact named consumers, canonical visible ZAR formatting, and residual generic-motion removal.
- Added shared portal grid utilities that stack to one column at `max-width: 860px`.
- Converted only the brief-listed Dashboard, Scout detail, Evaluate, Cost Oracle result, Projects, project finance, and parcel-facts grids.
- Routed visible money in the brief-listed consumers through `formatZar`, preserving dates, square metres, percentages, and request/API payloads.
- Removed the button hover translation and replaced named generic Tailwind transitions with the shared 160ms prescribed-easing transition.
- Preserved the existing shell breakpoint, page-entry keyframes, reduced-motion override, auth/capability behavior, and brand assets.

## RED evidence

Command:

```text
pnpm test:ui-foundation
```

Result: exit 1 before production changes.

```text
AssertionError [ERR_ASSERTION]: .portal-grid-2 must define an explicit 2-column portal grid
at scripts/ui-foundation-smoke.ts:123:12
```

The failure was the first newly required Task 5D contract and demonstrated that the focused source assertions detected the missing responsive utility.

## GREEN evidence

| Gate | Result |
|---|---|
| `pnpm test:ui-foundation` | PASS — `UI foundation contract smoke passed` |
| `pnpm --filter web typecheck` | PASS — exit 0 |
| `pnpm --filter web lint` | PASS — exit 0 |
| placeholder local Supabase/worker env `pnpm --filter web build` | PASS — compiled and generated 26/26 static pages; known multi-lockfile warning only |
| local Supabase + web `127.0.0.1:3001` + worker `127.0.0.1:8001` `pnpm test:auth-roles` | PASS — authenticated role/RLS/Viewer/cleanup assertions |
| same isolated runtime `pnpm test:api:workflow` | PASS — listing, feasibility, project, check-in, documents, capital, scraper, team removal |
| `cd apps/worker && PYTHONPATH=. uv run --extra dev pytest -q` | PASS — 40 passed |
| `git diff --check` | PASS — no whitespace errors |

### Runtime harness note

The first API workflow attempt returned `422 tariff bundle for 2029 is unavailable` because the worker launch omitted `DATABASE_URL` and therefore used its localhost:5432 default instead of local Supabase on 54322. No product code changed. Relaunching the same worker on port 8001 with Supabase's `DB_URL` made the unchanged workflow pass. Redis was unavailable, so the worker used its existing in-memory rate-limit fallback; this did not fail the required workflow.

## Self-review

- Authorization/business behavior: no handler, API, database, capability, persistence, or payload changes.
- Accessibility: no image or interactive-control semantics were added or removed; existing accessible project-name input label remains intact.
- Brand: no asset or C-mark changes; production CSS still contains no `#E61414` use.
- Responsive contract: all explicit portal grids are one column in the existing `@media (max-width: 860px)` block; the existing two-column `.stat-grid` treatment remains where it does not overflow.
- Money contract: named currency consumers import `formatZar` directly; remaining `toLocaleString` calls in reviewed files format square metres only.
- Motion: named consumers contain no `transition-all`/`transition-colors`; button hover translation is removed; 160ms prescribed easing and reduced-motion disabling remain.
- Repository hygiene: `.superpowers/audits/` and `.learnings/ERRORS.md` are audit/learning artifacts and are intentionally excluded from the Task 5D commit.
