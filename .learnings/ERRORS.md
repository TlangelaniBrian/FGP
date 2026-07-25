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

## [ERR-20260713-TASK4-COUNT] Drizzle count projection was not executable

**Logged**: 2026-07-13T21:30:00+02:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
The first Task 4 typecheck found that a Drizzle projection without a `FROM`
remained a select builder and could not be destructured as a result row.

### Error
```
lib/capital-governance.ts: Type 'PgSelectBuilder' must have a Symbol.iterator method
```

### Context
- The new goal quorum calculation attempted two scalar subqueries in one
  projection without selecting from a table.

### Suggested Fix
Use explicit count queries against the electorate and approval tables. This was
applied before migration or runtime verification.

---

## [ERR-20260713-TASK4-BACKFILL] PostgreSQL target alias unavailable in lateral update

**Logged**: 2026-07-13T21:34:00+02:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The rollback-only migration replay rejected a lateral subquery that referenced
the target alias of an `UPDATE`.

### Error
```
ERROR: invalid reference to FROM-clause entry for table "proposal"
```

### Context
- No schema changes persisted because the migration ran inside a transaction
  with `ON_ERROR_STOP` and an explicit rollback.

### Suggested Fix
Use a correlated scalar subquery in the `SET` expression for conservative
legacy proposer resolution.

---

## [ERR-20260713-TASK4-RLS] Drizzle error wrapping and PostgREST no-op semantics

**Logged**: 2026-07-13T21:40:00+02:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
The first post-migration smoke exposed two adapter semantics: postgres-js keeps
the unique-violation code under `cause`, and RLS-filtered PATCH may return 204
while mutating zero rows.

### Error
```
duplicate key value violates unique constraint capital_goal_one_pending_idx
direct governance PATCH returned 204 with no row changed
```

### Context
- The database constraints and RLS effects were correct; the API error mapping
  and integration assertion needed to reflect their adapters.

### Suggested Fix
Inspect both direct and nested database error codes, and prove RLS denial by
comparing persisted rows before and after direct mutation attempts.

---

## [ERR-20260713-TASK4-API-SMOKE] Legacy API smoke is unauthenticated

**Logged**: 2026-07-13T21:48:00+02:00
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
The legacy `test:api` smoke expects authenticated workspace routes to return
200 without sending a Supabase session.

### Error
```
AssertionError: /api/activity returned 401; expected 200
```

### Context
- Task 4 authenticated role, workflow, and governance smokes all authenticate
  and pass.
- The 401 is the intended active-member boundary established before Task 4.

### Suggested Fix
Retire the unauthenticated smoke or provision an isolated authenticated member
as the newer role/workflow smokes do.

---

## [ERR-20260713-TASK4-WORKER-PATH] Worker pytest requires PYTHONPATH

**Logged**: 2026-07-13T22:02:00+02:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Running the optional worker suite without `PYTHONPATH=.` caused collection
errors for its top-level modules.

### Error
```
ModuleNotFoundError: No module named 'services'
ModuleNotFoundError: No module named 'main'
```

### Context
- No worker or shared worker contract was changed by Task 4.

### Suggested Fix
Use the repository's established command:
`PYTHONPATH=. .venv/bin/pytest -q`.

---
