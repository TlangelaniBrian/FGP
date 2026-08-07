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
- Compliance document PDF generation and download over local artifact storage.
- Structured per-category tariff editor.
- Deterministic demo seeding: five role users, reference tariffs, spatial fixtures,
  five Gauteng leads, three projects with full detail, three months of contributions.
- Documentation: `docs/architecture.md`, `docs/demo-runbook.md`, rewritten README.

## Open

Tracked as GitHub issues. Ordered by what a first-time viewer notices.

- [ ] Capital page still posts through the legacy `/api/capital` multiplexer instead of
      the dedicated routes; the multiplexer cannot be deleted until it does. (#11, #12)
- [ ] Five-role browser acceptance suite is written but not landed; its GitGuardian
      check fails on the deterministic demo password. (#15, PR #27)
- [ ] Tariff API validation and seed bulk-rate parity. (#13, #14)
- [ ] Scout zoning compliance flow end-to-end verification. (#9)
- [ ] Scraper network, Celery wiring and GIS ingestion — owner-gated. (#16, #17, #18)
- [ ] Six WeasyPrint compliance templates. (#19)
- [ ] Housekeeping: amenity bug, remaining env/doc drift, dead code. (#20)
- [ ] Deployment and Azure Blob storage — owner-gated. (#21)

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
