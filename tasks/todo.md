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
- [x] Fix authenticated identity and Viewer/role enforcement end to end.
- [x] Make capital governance atomic, user-ID based, and impossible to bypass through settings/RLS.
- [x] Recompute saved feasibility decisions server-side and add spatial/envelope evidence plus luxury units.
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

## Task 1 PDF object-path remediation (2026-07-13)

- [x] Add failing integration coverage for caller-controlled and cross-owner PDF paths.
- [x] Remove `pdfUrl` from document PATCH and enforce the generated object namespace on download.
- [x] Run focused smoke, typecheck, lint, and diff verification.
- [x] Append evidence and commit the focused fix without audit artifacts.

## Task 3 feasibility decision integrity (2026-07-13)

- [x] Capture worker RED evidence for luxury, capacity, nullable density, and missing zoning evidence.
- [x] Capture authenticated integration RED evidence for forged save outputs and invalid tariff writes.
- [x] Share one canonical Next.js analysis contract and server-owned worker calculation path across analyze/save.
- [x] Add luxury and tariff-year support end to end without changing the visual design.
- [x] Enforce density, FAR, footprint/storey capacity and degraded zoning outcomes.
- [x] Add category-specific tariff validation and update workflow fixtures to canonical save inputs.
- [x] Run the complete Task 3 GREEN verification matrix, self-review, report, and local commit.

## Task 3 independent review remediation (2026-07-13)

- [x] Capture RED for non-2026 tariff completeness, null zoning evidence, typed capacity, and durable report evidence.
- [x] Restrict fallback tariffs to 2026 and reject missing or partial later-year bundles.
- [x] Require usable zoning constraints before returning a definitive decision.
- [x] Persist actual units, decision/evidence state, and capacity components atomically.
- [x] Apply the trusted-decision migration and run the full GREEN matrix.
- [x] Append the Task 3 report, self-review, and commit locally without audit artifacts.

## Task 4 atomic capital governance (2026-07-13)

- [x] Capture authenticated RED evidence for reserved settings, role boundaries, stable-member approvals, concurrency, atomic effects, and direct-write denial.
- [x] Add normalized electorate/approval schema and safe legacy backfill migration.
- [x] Implement transactional goal and correction mutation services plus minimal handler/UI contract changes.
- [x] Apply the migration locally and run the complete Task 4 GREEN verification matrix.
- [x] Self-review, write the Task 4 report, and commit locally without pushing.

## Task 4 independent review remediation (2026-07-13)

- [x] Capture RED for removed-ledger refresh, finalized approvals/activity, completed legacy approval history, and unresolved-maker quarantine.
- [x] Filter removed contributions from the effective ledger while retaining audit rows.
- [x] Preserve recognizable approved/rejected legacy approvals and reject unresolved pending correction makers during migration.
- [x] Return approval state-change flags and suppress duplicate approval activity events.
- [x] Replay exact migrations 0001-0018 and run the full authenticated verification matrix.
- [x] Append review evidence, self-review, and commit locally without pushing.

## Task 5D portal visual foundation slice (2026-07-13)

- [x] Add focused source assertions for explicit portal grid consumers and canonical visible ZAR formatting.
- [x] Convert the named Evaluate, Cost Oracle, Parcel facts, Dashboard, Scout, and Project finance grids to the 860px portal contract.
- [x] Route the named visible money consumers through `formatZar` without changing dates, areas, percentages, or API payloads.
- [x] Remove residual generic transitions and button hover translation while preserving the existing entry and reduced-motion contract.
- [x] Run the complete Task 5D verification matrix and self-review the authorized visual-only diff.

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

The final PDF path hardening removes caller control of `pdf_url` from document
status updates and validates stored paths against the exact owner, document ID,
and document type namespace used by server-side generation before signing.

Task 3 now uses one strict canonical input contract for analysis and persistence,
recomputes every saved decision through the worker inside an atomic database
transaction, exposes evidence-aware capacity limits without sentinel values,
supports luxury units and explicit tariff years, and rejects semantically invalid
tariff writes before they reach storage.

The independent-review remediation restricts hard-coded tariff fallback to its
real 2026 vintage, rejects incomplete later-year bundles, treats empty zoning
rows as degraded evidence, and persists actual units plus structured capacity
and decision-evidence fields so stored costs remain auditable.

Task 4 reserves `capital_goal` behind the capital workflow, snapshots stable
member electorates, stores normalized approvals, and serializes quorum checks
with proposal/effect updates in database transactions. Correction makers no
longer count as co-signers, direct PostgREST governance writes are denied, and
the Capital UI renders names and signed state from member-ID-backed responses.

Verification: `supabase migration up --local`, live capital API read/write,
Viewer 403 checks for capital/settings/tariffs, `pnpm --filter web typecheck`,
`pnpm --filter web lint`, `pnpm --filter web build`, API smoke coverage, and 28 worker tests all
pass. Next.js still
emits a workspace-root warning because the machine has multiple lockfiles; it
does not fail the build.
