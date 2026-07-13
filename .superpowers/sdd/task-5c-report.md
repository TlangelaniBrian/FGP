# Task 5C Report — Independent colour mode and visual direction

## Result

Implemented independent light/dark colour mode and Classic/Navy/Bold visual
direction without changing server-owned actor, capability, or route behavior.

## Scope

- Added `ColourMode = "light" | "dark"` and
  `VisualDirection = "classic" | "navy" | "bold"`.
- Replaced the overloaded `fgp_visual_mode` preference with independent
  `fgp_colour_mode` and `fgp_visual_direction` keys.
- Applied `data-mode` and `data-dir` independently to both `<html>` and
  `.portal-app`.
- Kept preference writes inside appearance-control click handlers, so initial
  rendering and state synchronization do not write browser storage.
- Kept the Classic/Navy/Bold segmented control and added a labelled
  `PortalIcon` light/dark button with `aria-pressed`.
- Added visible keyboard focus treatment to interactive controls.
- Converted shared canvas, surface, elevated, border, ink, muted, hover,
  selected, scrim, shadow, map, and massing neutrals to semantic tokens.
- Added the handoff's dark neutral ramp and retained Navy/Bold as independent
  `data-dir` overrides.
- Added the shared-shell 860px breakpoint, prescribed easing, `.portal-page`
  entry animation, and reduced-motion override required by Task 3's approved
  GREEN contract. Page-specific grid conversions and money-consumer changes
  remain intentionally deferred to Task 5D.

## RED evidence

Command:

```text
pnpm test:ui-foundation
```

Result before production changes: exit 1 at the intended missing behavior.

```text
AssertionError [ERR_ASSERTION]: AppShell must persist colour mode independently
expected: /fgp_colour_mode/
```

## GREEN evidence

Final fresh verification:

```text
pnpm test:ui-foundation
UI foundation contract smoke passed

pnpm --filter web typecheck
$ tsc --noEmit

pnpm --filter web lint
$ eslint

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder \
pnpm --filter web build
Compiled successfully
Generated static pages (26/26)
```

All final commands exited 0. The build uses non-connecting placeholder values
because the isolated validation worktree does not contain deployment secrets.
Next.js emitted the pre-existing multiple-lockfile, middleware-deprecation, and
Node `module.register()` deprecation warnings.

## Self-review

- **Hard-coded neutral leaks:** no light/dark ramp values remain in component
  rules after the semantic token blocks; Tailwind theme aliases also resolve
  through those tokens. Functional status colors remain semantic colors.
- **Accessibility:** appearance controls are native buttons, keyboard
  reachable, explicitly labelled, expose pressed state, and receive a visible
  focus outline. Reduced-motion preferences disable nonessential motion.
- **Persistence:** `localStorage.setItem` is reached only from explicit colour
  or direction clicks. The two preferences are read and updated independently.
- **Authentication/authorization:** `PortalActorProvider`, actor rendering,
  Viewer banner, sign-out flow, capabilities, routes, and API behavior are
  unchanged.
- **Brand integrity:** SHA-256 hashes for all three shipped SVGs match the
  authoritative handoff files exactly. Production CSS still contains no
  `#E61414`.
- **Diff hygiene:** `git diff --check` passes. No files under
  `.superpowers/audits/` were modified or staged.

## Concerns

None within Task 5C. Page-specific responsive grid conversion and exact money
consumer cleanup are intentionally left for Task 5D.
