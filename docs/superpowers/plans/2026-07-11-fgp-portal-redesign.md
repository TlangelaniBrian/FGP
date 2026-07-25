# FGP Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the FGP frontend around the supplied Capitec portal handoff and cover every major portal destination.

**Architecture:** Keep the existing Next.js App Router and API routes. Add a client-side application shell for navigation, visual modes, user permissions, notifications, and local prototype governance state. Keep page-specific server/client logic in route files and small shared components.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, React Hook Form, Zod, existing FGP API routes.

## Global Constraints

- Match the supplied handoff’s Capitec light visual language and responsive layout.
- Preserve the existing feasibility, parcel, tariffs, and projects API contracts.
- Use no new UI dependency for simple icons or primitives.
- Keep mutation affordances role-gated in both rendered controls and handlers.
- Verify with typecheck, lint, and production build.

### Task 1: Shared shell and visual system

**Files:** Modify `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/_components/Sidebar.tsx`; create `apps/web/app/_components/AppShell.tsx`, `apps/web/app/_components/PortalChrome.tsx`, `apps/web/lib/portal-state.ts`.

- [ ] Add shared `PortalChrome` with route-aware breadcrumbs, mode switcher, notifications, user switcher, Viewer banner, and responsive nav.
- [ ] Replace dark tokens and Playfair/DM Mono defaults with Capitec-aligned Nunito Sans tokens and light theme CSS.
- [ ] Add localStorage-backed `portal-state` helpers for mode, user, notifications, and permissions.
- [ ] Run `pnpm --filter web typecheck`.

### Task 2: Dashboard, Scout, Evaluate, and Result

**Files:** Modify `apps/web/app/page.tsx`, `apps/web/app/scout/page.tsx`, `apps/web/app/evaluate/page.tsx`, `apps/web/app/evaluate/result/page.tsx`, `apps/web/app/scout/_components/ScoutMap.tsx`, `apps/web/app/scout/_components/ParcelDetail.tsx`.

- [ ] Build the dashboard KPI, pinned-project, activity, and quick-action layout.
- [ ] Recompose Scout around search/filter controls, score cards, map surface, and existing parcel analysis.
- [ ] Restyle Evaluate form and Cost Oracle result without changing API payloads.
- [ ] Add compliance and project follow-up actions from result and parcel detail.
- [ ] Run lint and typecheck.

### Task 3: Projects, Capital fund, Tariffs, and Settings

**Files:** Modify `apps/web/app/projects/page.tsx`, `apps/web/app/projects/[id]/page.tsx`, `apps/web/app/settings/tariffs/page.tsx`, `apps/web/app/settings/page.tsx`; create `apps/web/app/capital/page.tsx`.

- [ ] Restyle projects list/detail around cards, status, timeline, budgets, and check-ins.
- [ ] Add Capital fund contribution ledger, goal progress, leaderboard, and local maker-checker/unanimous-goal interactions.
- [ ] Add role-aware tariffs editor and settings controls using portal permissions.
- [ ] Run lint and typecheck.

### Task 4: Verification and cleanup

**Files:** Modify any failing files from Tasks 1–3; create `tasks/todo.md` and `tasks/lessons.md`.

- [ ] Record task progress and review notes in `tasks/todo.md`.
- [ ] Run `pnpm --filter web typecheck`.
- [ ] Run `pnpm --filter web lint`.
- [ ] Run `pnpm --filter web build`.
- [ ] Fix all actual failures and re-run the complete verification set.
