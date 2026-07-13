# Task 5B Report — Canonical Assets, Icons, Font, and Formatter

## Scope

- Copied the three authoritative Capitec SVG assets without modification.
- Copied the authoritative Nunito Sans variable TTF without modification.
- Added `material-symbols` and a presentational `PortalIcon` wrapper.
- Replaced the assigned sidebar and topbar text glyphs with named rounded symbols.
- Replaced the sidebar footer's textual `C` with the canonical Capitec C-mark.
- Configured `next/font/local`, bound `--font-nunito` on `<html>`, and used the variable in the global font declarations.
- Added server-safe `formatZar` and retained the temporary `portal-state.ts` compatibility re-export.
- Preserved all navigation hrefs and authenticated actor/capability behavior.

## TDD Evidence

### RED before production changes

Command:

```text
pnpm test:ui-foundation
```

Result: expected failure, exit 1.

```text
AssertionError [ERR_ASSERTION]: Missing visual-foundation asset: apps/web/public/brand/capitec-c-mark.svg
```

### Formatter contract progression

After the assets and initial formatter implementation, the smoke reached the exact currency assertion and exposed Node's comma decimal separator for `en-ZA`:

```text
actual:   R 1 234,50
expected: R 1 234.50
```

The formatter now uses `Intl.NumberFormat("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(...)`, normalizes group separators to ordinary spaces, and normalizes the decimal separator to the required dot.

### Task 5B GREEN boundary

Command:

```text
pnpm test:ui-foundation
```

Result: expected remaining failure, exit 1, after all Task 5B asset and formatter assertions pass.

```text
AssertionError [ERR_ASSERTION]: AppShell must persist colour mode independently
```

This is the first Task 5C assertion. No dark-mode, responsive, or motion implementation was added in this slice.

## Verification

```text
pnpm --filter web typecheck
$ tsc --noEmit
exit 0
```

```text
pnpm --filter web lint
$ eslint
exit 0
```

The source and copied destinations were also compared byte-for-byte with `cmp` for all three SVGs and the TTF; each comparison exited 0.

`git diff --cached --check` reports two pre-existing trailing-whitespace lines inside the authoritative `capitec-c-mark.svg`. Those lines are intentionally preserved because the brief requires a byte-for-byte copy, not a redrawn or modified asset. `git diff --cached --check -- . ':(exclude)apps/web/public/brand/*.svg'` exits 0, and all copied SVGs pass the byte-for-byte `cmp` checks above.

## Self-review

- Confirmed no route hrefs changed.
- Confirmed actor lookup, role display, sign-out, and capability checks were not changed.
- Confirmed `PortalIcon` is always `aria-hidden="true"`; owning links retain visible labels and owning buttons have explicit accessible names.
- Confirmed the Capitec C-mark remains the supplied, unmodified SVG and is not recoloured.
- Confirmed the full logo and wordmark are shipped at their canonical public paths.
- Confirmed no dark-mode, motion, or breakpoint implementation was added.
- Confirmed `.superpowers/audits/` was neither edited nor staged.
