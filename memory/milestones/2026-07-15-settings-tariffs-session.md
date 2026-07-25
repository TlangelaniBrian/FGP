# Milestone — Settings complete, Tariffs at RED checkpoint

**Date:** 2026-07-15
**Branch:** `pull-new-designs`
**Isolated worktree:** `/private/tmp/fgp-pull-new-designs-validation.CtdZIq`
**Reviewed implementation through:** `daede9f`
**Documentation checkpoint:** `547c0e3`

## Publication

- Draft PR: https://github.com/TlangelaniBrian/FGP/pull/1
- Target: `main`; head: `pull-new-designs`
- Initial completed-scope publish: `4ae12b9`; current security-remediated head before this documentation update: `0b9b2f9`
- Fresh PR verification passed: Settings/UI/signature smokes, typecheck, lint, 40 worker tests, authenticated role/workflow/capital smokes, migrations `0001–0018`, `git diff --check`, and the 26-page production build.
- The PR is deliberately draft because Task 7B and the remaining full-product slices below are not claimed complete.

### GitGuardian boundary

- The first scan found two synthetic local-test passwords in historical commits: incident `27722495` in `scripts/capital-governance-migration-replay.sh` and incident `34833729` in `scripts/auth-role-smoke.mjs`.
- Commit `0b9b2f9` removes all current literals, generates smoke credentials at runtime, adds `pnpm test:security-regression`, and passes that test plus authenticated role/workflow and migration replay gates.
- GitGuardian continues to fail because it scans the full PR commit history and still sees the original occurrences.
- No history rewrite or force-push was performed. Clear the check by classifying/resolving the synthetic incidents in GitGuardian, or explicitly authorize a branch-history rewrite before attempting it.

## Decisions locked

- Keep the user checkout `/Users/tbmkhabela/Projects/Software/FGP` untouched; continue only in the isolated worktree.
- Preserve authenticated server-derived roles. Settings are editable by Owner, Chairperson, Treasurer, and Analyst; Viewer is read-only. Team management remains Owner/Chairperson only.
- Settings persist exactly seven strict keys: `autoAnalyze`, `scoreThreshold`, `email`, `whatsapp`, `weekly`, `digest`, and `scrapers` with six exact source booleans.
- Tariffs must use typed fields while preserving the six existing worker payload shapes exactly; no raw JSON editor.
- Local service ports are web `3001`, worker `8001`, Supabase API `54321`, and database `54322`. Martin owns `3000`/`8000`.
- When starting isolated web, load the local FGP web environment and explicitly override `WORKER_URL=http://127.0.0.1:8001`.

## Completed this session

- Added and committed the Task 7 implementation plan: `54f1a9a docs: plan settings and tariffs controls`.
- Implemented strict persisted Settings controls: `daede9f feat(settings): persist notification and scraper controls`.
- Task 7A verification passed: settings contract smoke, authenticated Owner/Chairperson/Treasurer/Analyst/Viewer matrix, typecheck, and lint.
- Fresh Task 7A review approved with no Critical or Important findings.
- Recorded one Minor for final triage: an in-flight Settings GET/PUT response can overwrite a very recent local toggle edit.
- Tasks 1–6 remain approved as recorded in `.superpowers/sdd/progress.md`; no prior work was redone.

## Current resumable state

- Task 7B was intentionally stopped at the genuine RED checkpoint when the user ended the session.
- Untracked `scripts/tariff-controls-smoke.ts` is the test-first draft. It imports the not-yet-created `apps/web/lib/tariff-editor.ts`, so `pnpm exec tsx scripts/tariff-controls-smoke.ts` should fail with the expected missing-module error.
- No Task 7B production file has been modified and no Task 7B commit exists.
- `.superpowers/audits/` remains unrelated and untracked.
- `.learnings/ERRORS.md` contains controller-only local validation notes and is intentionally uncommitted.
- The completed branch scope is published in draft PR #1; Task 7B and all later goal slices remain explicitly outside that completed scope.

## Exact next steps

1. Read `docs/superpowers/plans/2026-07-15-settings-tariffs-controls.md`, `.superpowers/sdd/progress.md`, and this milestone.
2. Resolve/classify GitGuardian incidents `27722495` and `34833729`, or explicitly decide whether to rewrite branch history; confirm the PR check state afterward.
3. Inspect PR #1 review feedback and address actionable findings on `pull-new-designs` before new feature work.
4. Resume Task 7B from `scripts/tariff-controls-smoke.ts`; preserve the existing RED evidence and implement `apps/web/lib/tariff-editor.ts`, `TariffFields.tsx`, and the typed Tariffs page.
5. Start Supabase, worker on `8001`, and web on `3001` with the explicit worker override before `test:api:workflow`.
6. Run Task 7B focused smoke, authenticated workflow, typecheck, lint, and build; commit and dispatch a fresh task reviewer.
7. Run the Task 7C authenticated browser matrix and whole Task 7 review.
8. Continue the remaining goal slices: canonical municipal PDFs and worker authentication; real scraper/GIS and shared tenancy; durable browser visual regression and exact-host production deployment.

## Blockers

- No product-code blocker is known.
- Production deployment credentials/target host will still need live verification in the final slice.
