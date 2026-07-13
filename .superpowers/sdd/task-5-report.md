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
| `git diff --check b8ca938..HEAD -- . ':(exclude)apps/web/public/brand/capitec-c-mark.svg'` | PASS — scoped production diff has no whitespace errors; the canonical Capitec C-mark SVG is a byte-identical handoff asset whose authoritative path data contains trailing spaces |

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

## Final-review fix wave

The five Important final-review findings were fixed as one integrated TDD wave.

### RED evidence

Before production changes, `pnpm test:ui-foundation` exited 1 on the first new
assertion:

```text
AssertionError [ERR_ASSERTION]: AppShell must gate preference-dependent UI until validated preferences are adopted
```

The expanded smoke also covers narrow-toolbar wrapping, intrinsic containment,
semantic success/warning tokens and dark overrides, representative
Settings/Tariffs/Capital/Scout hard-coded-colour regressions, readiness-gated
appearance controls with no stale `.portal-app` attributes, and the truthful
scoped SVG whitespace wording below.

### Implementation evidence

- At `max-width: 860px`, the direction selector owns a complete toolbar row and
  all toolbar controls wrap intentionally. Hidden pre-readiness controls reserve
  the same text/icon geometry, then become accessible only after validated
  saved state is adopted.
- `.portal-page`, cards, dense grids, stacks, fields, and row children opt out
  of intrinsic-width expansion. Dense splits and list rows wrap on mobile; the
  side navigation remains the sole intentional horizontal scroll region.
- Success, warning, and danger surfaces/ink/borders now use semantic light and
  dark tokens. Settings, tariff, capital, scraper, zoning, linked-parcel, and
  representative parcel status content consume those tokens.
- The root pre-paint bootstrap remains authoritative. Before readiness,
  `.portal-app` has no stale `data-mode` or `data-dir`; preference-dependent
  controls are dimension-preserving but hidden, then render with validated
  saved state after mount without hydration mismatch.

### Fresh GREEN matrix

| Gate | Result |
|---|---|
| `pnpm test:ui-foundation` | PASS — `UI foundation contract smoke passed` |
| `pnpm --filter web typecheck` | PASS — exit 0 |
| `pnpm --filter web lint` | PASS — exit 0 |
| local Supabase placeholder environment `pnpm --filter web build` | PASS — compiled and generated 26/26 pages; only the documented multiple-lockfile, middleware, and Node deprecation warnings |
| local Supabase + web `127.0.0.1:3001` + worker `127.0.0.1:8001` `pnpm test:auth-roles` | PASS — authenticated role/RLS/Viewer/cleanup assertions |
| same isolated runtime `pnpm test:api:workflow` | PASS — listing, feasibility, project, check-in, documents, capital, scraper, and team removal |
| `cd apps/worker && PYTHONPATH=. uv run --extra dev pytest -q` | PASS — 40 passed |
| `git diff --check b8ca938..HEAD -- . ':(exclude)apps/web/public/brand/capitec-c-mark.svg'` | PASS — exact scoped check; canonical SVG exception documented |
| `cmp -s apps/web/public/brand/capitec-c-mark.svg /Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/assets/capitec-c-mark.svg` | PASS — authoritative C-mark remains byte-identical |

The first build probe omitted `DATABASE_URL` and failed while collecting API
route data; rerunning with the established local Supabase placeholder values
passed without a product-code change. The first auth smoke invocation used the
wrong environment variable name; the exact required invocation then passed.

### Authenticated 320×800 browser evidence

- Dashboard toolbar: viewport `320×800`, toolbar `left 16 / right 304 / width
  288`; direction selector `16..304`, colour `134..174`, notifications
  `186..226`, account `238..304`. Every control was visible, enabled, and
  inside the viewport.
- Dashboard and Settings `.portal-page`: `clientWidth 320`, `scrollWidth 320`.
  Capital and Tariffs were also probed as dense pages and both page/body pairs
  measured `clientWidth 320`, `scrollWidth 320`.
- Dark Settings threshold: `rgb(159, 192, 255)` on `rgb(17, 27, 43)`, **9.43:1**.
- Live dark success banner: `rgb(167, 237, 195)` on `rgb(18, 51, 34)`, **10.21:1**.
- The temporary authenticated Owner, membership, and actor activity were
  deleted after the probe and verified absent (`member_count=0`,
  `event_count=0`, user lookup `404`). Saving Settings re-persisted the values
  already loaded by the page and introduced no net preference change.

### Final self-review

- No handler, capability, database, actor-resolution, or business-calculation
  behavior changed.
- Appearance placeholders are `aria-hidden`, non-interactive, and reserve the
  exact segmented-control/icon geometry; live controls retain their existing
  labels, pressed states, and keyboard behavior.
- Semantic status tokens meet readable dark contrast in the measured content,
  and the immutable C-mark remains the only authoritative `#E61414` asset use.
- The canonical Capitec C-mark SVG is a byte-identical handoff asset; its two
  trailing-space findings are intentionally excluded only by the exact scoped
  diff-check command recorded above. No unqualified `git diff --check` pass is
  claimed.
