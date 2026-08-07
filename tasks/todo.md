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
