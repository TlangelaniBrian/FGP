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

## Review remediation

The independent review identified hydration divergence from render-time storage
reads, an unstable toggle label, and unchecked well-formed preference values.
The remediation makes server and first-client React renders deterministic while
retaining a validated pre-paint visual preference application.

### Remediation changes

- `<html>` now renders `data-mode="light"` and `data-dir="classic"` with
  `suppressHydrationWarning`.
- A fixed root-layout bootstrap runs before body paint, reads only
  `fgp_colour_mode` and `fgp_visual_direction`, validates against the shared
  allowlists, applies valid values to `<html>`, and safely falls back.
- `AppShell` uses literal `light` / `classic` state initializers and adopts the
  validated preferences after mount in a cancellable microtask. It does not
  write storage during bootstrap or mount.
- Explicit user handlers keep the root attributes synchronized with React;
  persistence remains inside the appearance-control click handlers.
- The toggle's accessible name is the stable `Dark colour mode`, with
  `aria-pressed` representing state.
- `portal-state` now exports shared keys, allowlists, runtime type guards, and
  validated readers. Invalid JSON and valid JSON outside the unions fall back
  to `light` / `classic`.
- The focused smoke now protects deterministic initialization, pre-paint
  validation, post-mount loading, stable labelling, executable guards, and
  invalid stored-value fallback.

### Remediation RED evidence

After adding the regression assertions and before production changes:

```text
pnpm test:ui-foundation
AssertionError [ERR_ASSERTION]: AppShell colour state must render deterministically as light
expected: /useState<ColourMode>\(["']light["']\)/
exit 1
```

An intermediate lint run correctly rejected synchronous state adoption inside
the mount effect:

```text
pnpm --filter web lint
apps/web/app/_components/AppShell.tsx:25:5
react-hooks/set-state-in-effect
exit 1
```

The state adoption was moved to a cancellable microtask, preserving the
required post-mount behavior without a synchronous cascading render.

### Remediation GREEN evidence

Fresh final verification:

```text
pnpm test:ui-foundation
UI foundation contract smoke passed
exit 0

pnpm --filter web typecheck
$ tsc --noEmit
exit 0

pnpm --filter web lint
$ eslint
exit 0

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder \
pnpm --filter web build
Compiled successfully
Generated static pages (26/26)
exit 0

git diff --check
exit 0
```

The build emitted only the previously documented multiple-lockfile,
middleware-convention, and Node `module.register()` deprecation warnings.

### Remediation self-review

- Server HTML and the first React client render are both light/classic.
- The pre-paint script contains no dynamic user content and reads only the two
  presentation keys; both values are runtime validated before DOM use.
- Mount-time adoption reads but never writes storage. Only explicit clicks
  call `writePortalPreference`.
- The label remains stable in both pressed states, and the icon remains
  presentational through `PortalIcon`.
- Actor/provider, Viewer behavior, sign-out, capabilities, routes, and API
  behavior remain unchanged.
- Brand assets and visual CSS were not modified in remediation.
- `.superpowers/audits/` remains untracked and untouched.

### Remediation concerns

None.
