# FGP execution tracker

Current state as of 2026-08-07. Historical detail for the completed Supabase-to-.NET
migration lives in git history and in the closed issues on GitHub; this file tracks
what is open.

## Delivered

- .NET API foundation: Identity, organizations, roles, policy enforcement, EF Core
  migrations as the only schema authority, local Mailpit for identity mail.
- Portable PostgreSQL/PostGIS schema; every hosted-database and TypeScript ORM runtime
  path removed, with a CI guard that keeps them removed.
- Organization-scoped portal routes for parcels, feasibility, projects, tariffs,
  settings, documents and capital.
- Capital fund governance: immutable contribution versions, distinct Owner/Chairperson
  correction approval, exact fund-goal electorate with proposer assent, and
  membership-change voiding with linked audit events.
- Compliance document PDF generation and download over local artifact storage, rendering
  through WeasyPrint (its native libraries were missing from the worker image, so every
  document had been silently falling back to plain text).
- Structured per-category tariff editor, including server-side per-category validation.
- Deterministic demo seeding: five role users, reference tariffs, spatial fixtures,
  five Gauteng leads, three projects with full detail, three months of contributions.
- Documentation: `docs/architecture.md`, `docs/demo-runbook.md`, rewritten README.

## Open

Sequenced in `docs/roadmap.md` and mirrored as GitHub milestones. Work the stages in
order; within a stage, the roadmap gives the step number.

- **Stage 0 — demo readiness (by 2026-08-10):** seed a ready compliance document so the
  zoning screen is not empty (#9); clear the GitGuardian false positive (#31, owner
  action); delete the orphaned `/api/team` stubs (#12).
- **Stage 1 — safety net:** land the five-role acceptance suite (#15) *before* the
  capital refactor, so role regressions are caught. Fix its logging first — compose logs
  currently bury Playwright's reporter.
- **Stage 2 — correctness and debt:** enrich the dedicated capital routes (#10), then
  migrate the page and delete the legacy multiplexer (#11); seed bulk-rate parity (#13),
  then surface tariff field errors (#14).
- **Stage 3 — feature depth:** six compliance templates (#19, currently one generic
  template serves every doc type); scraper network (#16) → API wiring (#17) → GIS
  ingestion (#18).
- **Stage 4 — owner-gated:** deployment and Azure Blob storage (#21).

Before starting any of these: rebase onto `main`, and verify the issue against the code.
On 2026-08-07, four of seventeen open issues were already delivered and two were
half-delivered.

## Gates

- No source-data classification, external import, scraper run against live sites,
  deployment, or cloud provisioning without separate explicit owner approval.
- Financial corrections require distinct Owner/Chairperson maker-checker approval.
- Fund-goal submission creates the proposer's immutable assent record.

## Working agreement

1. Write a checkable plan here for multi-file work.
2. Verify the plan against the live repository before editing.
3. Keep changes small and organization-scoped.
4. Run focused tests, then `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:api`,
   `pnpm test:worker`.
5. Record lessons in `tasks/lessons.md` when a correction changes the approach.

## Current slice — #9: seed a ready compliance document

- [x] Add `IArtifactStorage` to `DemoPortalDataSeeder.SeedAsync` and save one
      `zoning_certificate` PDF for the Soshanguve lead (status `ready`).
- [x] Wire storage through `Program.cs` `--seed-demo`.
- [x] Extend `DemoPortalSeedTests`: ready document exists with a downloadable PDF and
      reseeding keeps the count at one.
- [x] Run focused API tests, then the full verification matrix.
- [x] Reseed the local demo stack, restart the API, and confirm the Soshanguve zoning
      screen shows one ready document with a working PDF link.
- [x] Open the PR and report the iteration.

### Review

- Verified against main before editing: the compliance flow works end to end (#7/#33/#34);
  the remaining gap is exactly that `DemoPortalDataSeeder.ClearAsync` removes every
  `ComplianceDocument` and none are recreated.
- Change is seed-only: one `zoning_certificate` row (status `ready`) for the Soshanguve
  lead, with a real stored PDF via `IArtifactStorage`; no API or UI code changed.
- Focused `DemoPortalSeedTests`: 2/2 passed. Full matrix: web 32/32, API 131/131,
  worker 47/47, plus lint, typecheck and production build.
- Live demo stack reseeded and API restarted; `GET /api/documents?listingId=24` returns
  the ready document and `GET /api/documents/5/download` returns a valid 1-page PDF
  (`application/pdf`, parses with pypdf).

### Review follow-up — deterministic demo artifact key

- [x] Seed writes to `documents/{orgId:N}/demo/zoning-certificate.pdf` so reseeds
      overwrite the same blob instead of accumulating orphaned PDFs under fresh ids.
- [x] `DemoPortalSeedTests` pins the deterministic key in both the populate and
      idempotency tests.
- [x] Reseeded the local demo stack, verified the overwrite path, and removed the two
      pre-fix orphaned PDFs from `.artifacts/`.
- [x] Full matrix re-run green; pushed to PR #38.

## Current slice — #12: delete the `/api/team` stubs

Scope per `docs/roadmap.md` Stage 0: remove the three `501` stub handlers, their route
mappings, request records, and the now-unused `AllowedRoles` list. The functional
`GET /api/team` stays; the static web permission map is a separate, non-Stage-0 slice.

- [x] Verify live: POST/PATCH/DELETE `/api/team` return 501; no web callers; the
      working path is `/api/organizations/members` (200 live).
- [x] Delete the three stub handlers + mappings + `TeamMemberRequest`/`TeamUpdateRequest`
      + `AllowedRoles`.
- [x] Run focused API tests, then the full verification matrix.
- [x] Restart the API and confirm the stubs no longer respond 501 while the replacement
      paths still return 200.
- [x] Open the PR and report the iteration.

### Review

Scope per `docs/roadmap.md` Stage 0 is the dead `/api/team` stubs only. The static web
`permissions` map and `can(role, ...)` migration are part of the fuller #12 scope but
are not Stage 0; they remain open for the phase-2 slice.

- Verified live before editing: GET `/api/team` 200, POST/PATCH/DELETE 501, and the
  replacement `GET /api/organizations/members` 200; no web or test references to the
  stubs.
- Deleted the three stub handlers, their route registrations, the request records, and
  the now-unused `AllowedRoles` field. Kept the functional `GET /api/team`.
- Full matrix green: web 32/32, API 131/131, worker 47/47; lint, typecheck, build pass.
- After API restart, POST/PATCH/DELETE `/api/team` return 405 (no handler) instead of
  501, `GET /api/team` and `/api/organizations/members` still 200.

## Current slice — #15 / PR #27: make the acceptance harness actually run

PR #27 is the five-role acceptance suite (#15). Its `acceptance` CI job never ran
Playwright: the readiness probe could never match and the runner could not find the
Playwright config. #31 (GitGuardian dashboard false positive) is an owner action and
remains the only merge blocker after these fixes.

- [x] Rebase PR #27 onto current `main` (was 4 behind).
- [x] Probe `/sign-in` for web readiness instead of matching dashboard HTML truncated to
      2000 bytes.
- [x] Run Playwright from `apps/web` so the config and specs are found.
- [x] Keep the container's Linux `node_modules` out of the host checkout via named
      volumes (same class as the #34 worker fix).
- [x] Upload `playwright-report/` and `test-results/` from CI on every run.
- [x] Note the CapabilityPolicy-vs-handoff divergence in the suite instead of silently
      picking a side; remove dead `signOut`; return body with `apiStatus`.
- [x] README: use `playwright install --with-deps` and warn that the script tears the
      stack down.
- [x] Full matrix green; Playwright collects 10 specs; pushed for CI.

### Review

Local verification: `bash -n` and `docker compose config -q` pass; Playwright collects
10 specs; vitest excludes `e2e/` while keeping `configDefaults`; full matrix green
(web 32/32, API 131/131, worker 47/47, lint/typecheck/build).

CI on the final head (`9b78fca`): `verify` passed (2m37s), `acceptance` passed (2m53s)
with all 10 Playwright specs actually running. GitGuardian still fails on the
deterministic demo password — #31 owner dashboard action is the only remaining blocker.

## Current slice — #15: complete role×page acceptance coverage (scraper/capital/zoning)

PR #27 merged the five-role suite for settings and tariffs only. The scraper, capital,
and zoning pages are still missing from the role matrix, so #15 stays open until every
page asserts its `CapabilityPolicy` vectors.

- [x] Extend `FIVE_ROLES` with the remaining `Capabilities.All` vectors.
- [x] `scraper.spec.ts`: queue form vs read-only per `RecordContribution`; POST 201/403.
- [x] `capital.spec.ts`: record/propose/correct controls per `RecordContribution`,
      `ProposeFundGoal`, `ProposeCorrection`; API 403 matrix for every denied vector.
- [x] `zoning.spec.ts`: status/package controls and document writes per
      `RecordContribution`, against the seeded Soshanguve listing.
- [x] Fix the capital page gating divergence the suite exposed: Chairperson is denied
      `proposal` by the static web map but allowed by the API, so the goal/correction
      controls were hidden; gate the page on session capabilities instead.
- [x] Run lint/typecheck/build/test:web, then the local acceptance stack, then the
      API and worker suites.
- [x] Open the PR and report the iteration.

## Current slice — #12: permission parity — web gating on session capabilities

The API half of #12 (dead `/api/team` stubs) shipped in #39; the capital page gating
divergence shipped with #40. This slice removes the remaining static web permission
matrix so no `can(role, ...)` call survives and the API `CapabilityPolicy` is the only
source of truth.

- [x] Migrate the scraper and zoning pages to `useSession().capabilities`
      (`RecordContribution`); they were already edited in the working tree.
- [x] Migrate `ThisWeek`, `ProjectActions`, `ProjectDetailEditor`, and
      `LinkParcelForm` from `can(role, ...)` to session capabilities.
- [x] Delete the static `team`, `permissions`, and `can` exports from
      `lib/portal-state.ts` (keep `Role` and preference helpers).
- [x] Add `projects.spec.ts` and `scout.spec.ts` role-matrix coverage for the four
      migrated components (`ProjectActions`, `ProjectDetailEditor`, `ThisWeek`,
      `LinkParcelForm`) per the PR #41 review comment.
- [x] Re-review fix: share one coordinate-less listing via `beforeAll` so the scout
      Viewer branch exercises the `LinkParcelForm` capability guard instead of the
      vacuous seeded-listing path.
- [x] Run lint/typecheck/build/test:web, then the acceptance stack, then API/worker.
- [x] Open the PR and report the iteration.
