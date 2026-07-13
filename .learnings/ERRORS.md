## [ERR-20260711-001] frontend-lint

**Logged**: 2026-07-11T00:00:00+02:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
The first portal redesign verification pass failed on pre-existing MapLibre wrapper `any` types and a ref mutation during render.

### Error
`@typescript-eslint/no-explicit-any` and `react-hooks/refs` errors in `apps/web/app/scout/_components/ScoutMap.tsx`.

### Context
- Added the shared Capitec portal shell and redesigned dashboard/capital/settings surfaces.
- Ran `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build`.

### Suggested Fix
Use small local MapLibre interface types and update the callback ref inside an effect.

---

## [ERR-20260711-002] live-server-check

**Logged**: 2026-07-11T00:00:00+02:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The dev server was no longer listening when the first post-build curl checks ran.

### Error
`curl: (7) Failed to connect to localhost port 3000`.

### Context
The production build completed successfully before the live checks. Restarting
`pnpm dev` restored the endpoint and the handler checks passed.

### Suggested Fix
Start the dev server after a build before running live HTTP checks.

---
## [ERR-20260713-RTK] rtk unavailable in isolated clone

**Logged**: 2026-07-13T00:00:00+02:00
**Priority**: low
**Status**: pending
**Area**: config

### Summary
The repository-mandated `rtk` wrapper is not installed or available on PATH in this isolated environment.

### Error
```
zsh:1: command not found: rtk
```

### Context
- Attempted to read required skill and task-brief files through `rtk read`.
- Working directory: `/private/tmp/fgp-pull-new-designs-validation.CtdZIq`.

### Suggested Fix
Install `rtk` on PATH for isolated validation clones, or continue with raw commands when unavailable.

### Metadata
- Reproducible: yes
- Related Files: AGENTS.md

---
