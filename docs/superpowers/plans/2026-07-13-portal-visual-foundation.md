# Portal Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared portal shell faithfully implement the supplied Capitec brand, appearance controls, typography, money formatting, motion, and 860px responsive contract.

**Architecture:** Keep visual direction (`classic`, `navy`, `bold`) separate from colour mode (`light`, `dark`) and persist both as presentation-only browser preferences. Ship the handoff's local brand/font assets, wrap Material Symbols in one accessible component, centralize ZAR formatting in a server-safe helper, and expose explicit responsive grid classes instead of relying on page-specific Tailwind breakpoints.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, local Nunito Sans variable font, Material Symbols Rounded, Node/tsx contract smoke.

## Global Constraints

- The supplied design handoff at `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal` is authoritative and read-only; copy required assets into this isolated worktree.
- Preserve authenticated actor and capability behavior; appearance state is never authorization state.
- Use `#E61414` only for the unmodified Capitec C-mark; critical errors use `#A5132A`.
- Format ZAR as `R 1 234.56` with spaces and exactly two decimals.
- Use 120-200ms motion with `cubic-bezier(0.2, 0, 0, 1)` and respect `prefers-reduced-motion`.
- Collapse the fixed side navigation at `max-width: 860px` and stack page grids at that same breakpoint.
- Capture failing contract evidence before production changes, then run typecheck, lint, build, focused smoke, existing authenticated smokes, and worker tests.

---

### Task 1: Visual foundation contract smoke

**Files:**
- Create: `scripts/ui-foundation-smoke.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `formatZar(value: number): string` from `apps/web/lib/format.ts` after Task 2.
- Produces: root command `pnpm test:ui-foundation` with deterministic source/asset assertions.

- [ ] **Step 1: Write the failing smoke**

  Use `node:assert/strict`, `node:fs`, and `node:path`. Assert that `formatZar(1234.5)` is `R 1 234.50`, the three copied brand assets and local font exist, `AppShell.tsx` exposes separate colour/direction state, `PortalChrome.tsx` renders a colour-mode control through `PortalIcon`, and `globals.css` contains dark tokens, `@media (max-width: 860px)`, the prescribed easing, entry animation, and reduced-motion override.

- [ ] **Step 2: Add and run the RED command**

  Add `"test:ui-foundation": "tsx scripts/ui-foundation-smoke.ts"` to the root scripts. Run `pnpm test:ui-foundation`; expect failure on the first missing asset/contract.

- [ ] **Step 3: Commit RED evidence only if repository policy permits test-only commits**

  Use `test(ui): define visual foundation contract` if committed separately; otherwise preserve the failing output in the task report before implementation.

### Task 2: Canonical assets, icons, font, and formatter

**Files:**
- Copy: `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/assets/capitec-c-mark.svg` to `apps/web/public/brand/capitec-c-mark.svg`
- Copy: `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/assets/capitec-logo-full.svg` to `apps/web/public/brand/capitec-logo-full.svg`
- Copy: `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/assets/capitec-wordmark.svg` to `apps/web/public/brand/capitec-wordmark.svg`
- Copy: `/Users/tbmkhabela/Projects/Software/FGP/docs/design_handoff_fgp_portal/capitec-ds/fonts/NunitoSans-Variable.ttf` to `apps/web/app/fonts/NunitoSans-Variable.ttf`
- Create: `apps/web/app/_components/PortalIcon.tsx`
- Create: `apps/web/lib/format.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/_components/Sidebar.tsx`
- Modify: `apps/web/app/_components/PortalChrome.tsx`
- Modify: `apps/web/lib/portal-state.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `PortalIcon({ name, className? })`, `formatZar(value: number): string`, and public `/brand/*` assets.
- Preserves: all current navigation paths and authenticated actor rendering.

- [ ] **Step 1: Install the rounded symbol font and ship local handoff assets**

  Add `material-symbols` to `apps/web` and import its rounded stylesheet globally. Copy, do not redraw or tint, the supplied SVGs. Configure `next/font/local` with the supplied variable TTF and bind it to `--font-nunito` on `<html>`.

- [ ] **Step 2: Add the accessible icon wrapper**

  Implement `PortalIcon` as a presentational `material-symbols-rounded` span with `aria-hidden="true"`; keep accessible names on the owning link/button. Replace sidebar/topbar glyphs and the textual footer `C` with named symbols plus the supplied images.

- [ ] **Step 3: Centralize exact money formatting**

  Implement `formatZar` using `Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` and normalize locale grouping to ordinary spaces before prefixing `R `. Re-export it from `portal-state.ts` temporarily for compatibility while moving consumers to `@/lib/format`.

- [ ] **Step 4: Run focused verification**

  Run `pnpm test:ui-foundation` and expect remaining failures to concern colour mode, CSS motion, or responsiveness rather than assets/font/formatting.

### Task 3: Independent light/dark mode and visual direction

**Files:**
- Modify: `apps/web/app/_components/AppShell.tsx`
- Modify: `apps/web/app/_components/PortalChrome.tsx`
- Modify: `apps/web/lib/portal-state.ts`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces: `ColourMode = "light" | "dark"`, `VisualDirection = "classic" | "navy" | "bold"` and independent persisted keys `fgp_colour_mode` / `fgp_visual_direction`.
- Preserves: presentation-only localStorage and server-owned actor/capability state.

- [ ] **Step 1: Split state and persistence**

  Replace the overloaded visual mode with separate colour and direction state. Apply `data-mode` and `data-dir` to both `document.documentElement` and `.portal-app`, and persist only after a user action.

- [ ] **Step 2: Render the appearance controls**

  Keep the Classic/Navy/Bold segmented control and add a labelled light/dark icon button with `aria-pressed`. Ensure every control is reachable by keyboard and carries an explicit accessible name.

- [ ] **Step 3: Convert shell CSS to semantic light/dark tokens**

  Define all canvas, surface, elevated, border, ink, muted, hover, selected, scrim, and shadow values as root variables. Add `[data-mode="dark"]` overrides based on the handoff's dark neutral ramp, then replace hard-coded shell/component neutrals so cards, menus, forms, banners, map/massing placeholders, and navigation remain legible in both modes. Preserve Navy/Bold direction overrides independently.

- [ ] **Step 4: Run focused smoke, typecheck, and lint**

  Run `pnpm test:ui-foundation`, `pnpm --filter web typecheck`, and `pnpm --filter web lint`; expect all to pass before responsive/money consumer cleanup.

### Task 4: Responsive grids, exact money consumers, and motion

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/scout/page.tsx`
- Modify: `apps/web/app/scout/[id]/page.tsx`
- Modify: `apps/web/app/evaluate/result/page.tsx`
- Modify: `apps/web/app/projects/page.tsx`
- Modify: `apps/web/app/projects/[id]/_components/FinanceStrip.tsx`
- Modify: `apps/web/app/projects/[id]/_components/BudgetTable.tsx`
- Modify: `apps/web/app/evaluate/page.tsx`
- Modify: `apps/web/app/scout/_components/ParcelDetail.tsx`
- Modify: `tasks/todo.md`
- Create: `.superpowers/sdd/task-5-report.md`

**Interfaces:**
- Consumes: `formatZar` from Task 2 and explicit `.portal-grid-2`, `.portal-grid-3`, `.portal-grid-4` classes.
- Produces: shell and content that stack at 860px with consistent exact currency copy.

- [ ] **Step 1: Replace fixed responsive grids**

  Add explicit portal grid utilities and convert the Evaluate, Cost Oracle, Parcel facts, and Project finance grids. At `max-width: 860px`, switch the app to horizontal navigation and each portal grid to one column; retain the existing two-column stat treatment only where it does not overflow.

- [ ] **Step 2: Route visible currency through `formatZar`**

  Replace page-local integer formatters and `R ${value.toLocaleString(...)}` occurrences in the listed user-facing views. Do not change dates, square metres, percentages, or machine/API payloads.

- [ ] **Step 3: Apply motion contract**

  Replace generic `ease` and hover translation with 120-200ms `cubic-bezier(0.2, 0, 0, 1)` transitions. Add the handoff's 8px-to-0 fade/translate entry animation to `.portal-page`; disable nonessential transition/animation under `prefers-reduced-motion: reduce`.

- [ ] **Step 4: Run the complete GREEN matrix**

  Run `pnpm test:ui-foundation`, `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`, `pnpm test:auth-roles`, `pnpm test:api:workflow`, and `cd apps/worker && PYTHONPATH=. uv run --extra dev pytest -q`. Expect zero failures and preserve the known harmless multi-lockfile build warning only.

- [ ] **Step 5: Self-review and commit**

  Run `git diff --check`, inspect every changed file for authorization drift, missing alt/accessibility labels, unmodified C-mark usage, exact 860px behavior, and unrelated edits. Append RED/GREEN evidence to `.superpowers/sdd/task-5-report.md`, mark only this slice complete in `tasks/todo.md`, and commit without pushing or staging `.superpowers/audits/`.
