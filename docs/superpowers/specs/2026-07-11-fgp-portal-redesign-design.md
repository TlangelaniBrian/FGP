# First Generation Properties Portal Redesign

## Goal

Rebuild the existing Next.js portal so its shared shell, typography, spacing,
colour, controls, and major workflows match the supplied Capitec-based design
handoff while preserving the existing feasibility, scout, and projects API
contracts.

## Product shape

The portal will use a fixed 256px desktop side navigation with a responsive
horizontal navigation bar below 860px. The top bar will expose breadcrumbs,
visual direction controls, notifications, and a current-user switcher. The
main destinations are Dashboard, Scout, Evaluate land, Cost oracle, Projects,
Capital fund, Tariffs, and Settings.

The first implementation will be a cohesive frontend product slice. Existing
server-backed flows remain server-backed. Governance, notifications, visual
direction, and settings are represented with client state and localStorage so
the interactions are usable without inventing new backend tables or APIs.

## Visual system

- Nunito Sans is used throughout, with tabular numerics for money and metrics.
- Light Capitec neutrals, brand navy `#0033A0`, action blue `#2F70EF`, maroon
  error `#A5132A`, 16px cards, pill buttons, and restrained shadows are the
  default.
- Classic, Navy, and Bold visual directions are implemented as root data modes.
- No emoji or model-authored SVG illustrations; icons use a text glyph fallback
  and CSS shapes where the existing app has no icon dependency.

## Interaction model

- Navigation uses real Next.js routes for every major destination.
- Dashboard quick actions link into Scout and Evaluate.
- Scout keeps its existing coordinate analysis API and presents parcel cards,
  filters, map surface, and analysis results in the new visual system.
- Evaluate keeps its existing form validation and feasibility API, while the
  result page presents Cost Oracle breakdowns and compliance next actions.
- Capital fund supports recording contributions, proposing a goal, and showing
  governance progress locally; Viewer mode disables mutation controls.
- Tariffs and Settings expose role-aware controls and persist visual/settings
  preferences locally.

## Verification

Run `pnpm --filter web typecheck`, `pnpm --filter web lint`, and
`pnpm --filter web build`. These prove the complete frontend compiles and the
existing route/API integrations remain type-safe.
