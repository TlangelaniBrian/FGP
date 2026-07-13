# FGP portal redesign

- [x] Record design and implementation plan.
- [x] Rebuild shared portal shell and visual system.
- [x] Redesign Dashboard, Scout, Evaluate, and Cost Oracle.
- [x] Redesign Projects, Capital fund, Tariffs, and Settings.
- [x] Add Parcel Detail and Zoning/Compliance routes from the design handoff.
- [x] Add durable capital, settings, compliance-document, and project mutation APIs.
- [x] Wire UI mutations to the API and enforce role checks in handlers.
- [x] Replace demo role headers with Supabase session middleware and RLS policies.
- [x] Add persisted team/activity APIs and scraper/listing ingestion routes.
- [x] Add source-specific JSON-LD scraper adapters and run-now job execution.
- [x] Add worker PDF generation with storage-backed download route and fallback renderer.
- [x] Run typecheck, lint, and production build.
- [x] Replace dashboard mock metrics, activity, and scout signal with persisted data.
- [x] Add production preflight and checked-in Supabase migration command.
- [x] Add positive authenticated workflow smoke coverage with cleanup.
- [ ] Complete authenticated production deployment and verify the live URL.

## Completion audit follow-up (2026-07-13)

- [x] Validate `pull-new-designs` in an isolated clone: install, typecheck, lint, 30 worker tests, production build, local authenticated API smoke, and workflow smoke.
- [x] Audit every handoff screen, backend workflow, security boundary, and verification claim.
- [ ] Fix authenticated identity and Viewer/role enforcement end to end.
- [ ] Make capital governance atomic, user-ID based, and impossible to bypass through settings/RLS.
- [ ] Recompute saved feasibility decisions server-side and add spatial/envelope evidence plus luxury units.
- [ ] Finish shell, brand assets, dark mode, 860px responsiveness, typography, money formatting, and motion fidelity.
- [ ] Finish Scout/Parcel/Cost Oracle signature views: map overlays, legend, fact chips, massing, and cost bars.
- [ ] Finish Settings/Tariffs controls and role-aware project/compliance mutation surfaces.
- [ ] Implement canonical municipal PDF templates/package storage and authenticated worker boundary.
- [ ] Complete source scrapers/job execution, GIS ingestion scripts, and clean migration/RLS verification.
- [ ] Add browser E2E/visual regression coverage and verify the production deployment on its exact public host.

## Task 1 re-review remediation (2026-07-13)

- [x] Add a focused failing smoke for direct Viewer writes, read-only downloads, and member-ID governance.
- [x] Split workspace RLS into active-member reads and non-Viewer writes.
- [x] Make document GET read-only and capability-guard document generation behind POST.
- [x] Key capital approvals by stable `team_members.id`, including active unbound members.
- [x] Apply the migration locally and run the focused and repository verification checks.
- [x] Append RED/GREEN evidence, self-review the diff, and commit only task files.

## Review

Implemented the shared Capitec-style shell, route-aware navigation, visual
modes, notifications/user switcher, Viewer read-only mode, dashboard, capital
fund interactions, settings preferences, role-gated tariffs, compliance
documents, project edits, and restyled Scout/Evaluate/Projects surfaces.

The second pass added backend contracts and migration 0006 for capital
contributions/governance, portal settings, compliance documents, project
updates, and handler-level role checks.

The Task 1 re-review remediation separates active-member reads from non-Viewer
writes in migration 0016, makes document downloads read-only with generation
behind a guarded POST, and keys all governance approvals to stable team member
IDs so active email-matched members remain part of unanimity.

Verification: `supabase migration up --local`, live capital API read/write,
Viewer 403 checks for capital/settings/tariffs, `pnpm --filter web typecheck`,
`pnpm --filter web lint`, `pnpm --filter web build`, API smoke coverage, and 28 worker tests all
pass. Next.js still
emits a workspace-root warning because the machine has multiple lockfiles; it
does not fail the build.
