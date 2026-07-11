# FGP portal redesign

- [x] Record design and implementation plan.
- [x] Rebuild shared portal shell and visual system.
- [x] Redesign Dashboard, Scout, Evaluate, and Cost Oracle.
- [x] Redesign Projects, Capital fund, Tariffs, and Settings.
- [x] Run typecheck, lint, and production build.

## Review

Implemented the shared Capitec-style shell, route-aware navigation, visual
modes, notifications/user switcher, Viewer read-only mode, dashboard, capital
fund interactions, settings preferences, role-gated tariffs, and restyled
Scout/Evaluate/Projects surfaces. Existing API routes remain in place; no
backend contract change was required for this frontend slice.

Verification: `pnpm --filter web typecheck`, `pnpm --filter web lint`, and
`pnpm --filter web build` all pass. Next.js still emits a workspace-root
warning because the machine has multiple lockfiles; this does not fail the
build.
