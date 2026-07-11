# FGP portal redesign

- [x] Record design and implementation plan.
- [x] Rebuild shared portal shell and visual system.
- [x] Redesign Dashboard, Scout, Evaluate, and Cost Oracle.
- [x] Redesign Projects, Capital fund, Tariffs, and Settings.
- [x] Add Parcel Detail and Zoning/Compliance routes from the design handoff.
- [x] Add durable capital, settings, compliance-document, and project mutation APIs.
- [x] Wire UI mutations to the API and enforce role checks in handlers.
- [x] Run typecheck, lint, and production build.

## Review

Implemented the shared Capitec-style shell, route-aware navigation, visual
modes, notifications/user switcher, Viewer read-only mode, dashboard, capital
fund interactions, settings preferences, role-gated tariffs, compliance
documents, project edits, and restyled Scout/Evaluate/Projects surfaces.

The second pass added backend contracts and migration 0006 for capital
contributions/governance, portal settings, compliance documents, project
updates, and handler-level role checks.

Verification: `supabase migration up --local`, live capital API read/write,
Viewer 403 checks for capital/settings/tariffs, `pnpm --filter web typecheck`,
`pnpm --filter web lint`, and `pnpm --filter web build` all pass. Next.js still
emits a workspace-root warning because the machine has multiple lockfiles; it
does not fail the build.
