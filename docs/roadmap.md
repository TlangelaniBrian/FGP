# Delivery order

Why this order, and what blocks what. Each claim below was checked against the code on
`main`, not inferred from issue titles — several issues turned out to be partly or wholly
delivered already, and the sequence reflects that.

Status as of 2026-08-07. Investor demo: 2026-08-10.

## The dependency graph

```
#31 GitGuardian ──▶ #15 acceptance suite ──▶ (safety net for everything after)

#10 capital routes ──▶ #11 delete legacy multiplexer

#13 bulk-rate parity ──▶ #14 tariff field errors

#16 worker scrapers ──▶ #17 API wiring ──▶ #18 GIS ingestion

#9  seed a document      ┐
#12 delete /api/team     ├── independent, no blockers
#19 form templates       ┘

#21 deployment ──▶ last: wants everything above stable
```

## Stage 0 — Before the demo (2026-08-07 → 08-10)

Only work that changes what a viewer sees, and only low-risk changes. **Do not start a
refactor in this window** — #10/#11 in particular touch the governance write path.

| Order | Issue | Why now | Risk |
| --- | --- | --- | --- |
| 1 | **#9** — seed one ready compliance document | `/scout/{id}/zoning` opens empty because the seed clears documents without recreating any. It is one of the eleven screens and currently shows nothing on a fresh seed. | Low — seed-only change |
| 2 | **#31** — clear the GitGuardian false positive | Owner action in the dashboard, not a code change. Unblocks #15. Do it early because it costs you minutes and blocks someone else's day. | None |
| 3 | **#12** — delete the `/api/team` stubs | Verified dead: Settings drives team management through `/api/organizations/members`, which works (GET and PATCH both return 200 live). The `/api/team` PATCH/DELETE handlers are `501` with no callers. Deleting dead code before a demo is safe; leaving a `501` in a live API is a bad look if anyone opens the network tab. | Low |

Everything else waits. If time runs short, do #9 only — it is the sole item in this stage
that changes a screen.

## Stage 1 — The safety net (immediately after the demo)

| Order | Issue | Why here |
| --- | --- | --- |
| 4 | **#15** — five-role browser acceptance suite | Blocked by #31. Land this *before* the Stage 2 refactors, not after. It is the only thing that will catch a role-permission regression when #11 rewrites the capital write path. Its `acceptance` job currently fails and cannot be diagnosed: `run-acceptance.sh` pipes compose logs over Playwright's reporter, so the log contains no test names or assertion text. **Fix the logging first**, then the tests. |

## Stage 2 — Correctness and debt

Ordered so each step leaves the tree consistent.

| Order | Issue | Why this position |
| --- | --- | --- |
| 5 | **#10** — enrich the dedicated capital routes | The governance payload half is already done (PR #28): `requiredMembers`/`members` are populated from active memberships. What remains is bringing the dedicated routes up to parity with what the legacy multiplexer returns. Must precede #11. |
| 6 | **#11** — migrate the capital page, delete the multiplexer | The page still POSTs every action to `/api/capital`. The multiplexer cannot be deleted until the page stops using it, and the routes cannot be trusted until #10. Highest-risk item on the list — it touches contributions, corrections and goal co-signing. Do it with #15 green. |
| 7 | **#13** — seed bulk-rate parity | `bulk_contributions` seeds only `bachelor` for each municipality, while `build_rates` covers bachelor/1bed/2bed/luxury. Evaluate does **not** break — all four unit types return 200 with distinct figures — but editing bulk contributions in Tariffs only meaningfully affects bachelor. Note the *validation* half of this issue is already delivered: per-category validators exist and reject bad input with 422. |
| 8 | **#14** — surface tariff field errors | Needs #13 so client and server agree on the shape. Also re-scoped: PR #26 replaced the raw JSON textarea with a structured editor, so the original "no client validation" complaint is gone. What remains is mapping a server 422 onto the specific field, and the "not set for {year}" empty state. |

## Stage 3 — Feature depth

| Order | Issue | Notes |
| --- | --- | --- |
| 9 | **#19** — six compliance templates | Currently **one** generic key/value template inline in `forms.py`; `doc_type` only changes the title, so `site_development_plan` and `rezoning_application` render identical layouts. Independent of everything else — can run in parallel with Stage 2. Highest visible value per unit of effort now that WeasyPrint actually renders (#33). |
| 10 | **#16** — Playwright scraper network and Celery | Deps are already declared and `routers/scraper.py` exists. Worker-side only. |
| 11 | **#17** — gated scraper run/ingest wiring in API | Needs #16. Owner-gated: does not run against live sites without approval. |
| 12 | **#18** — GIS ingestion endpoints | Needs #17. No `/geo/import/*` endpoints exist yet. Owner-gated. |

## Stage 4 — Owner-gated release

| Order | Issue | Notes |
| --- | --- | --- |
| 13 | **#21** — deployment and Azure Blob storage | Last by definition. `IArtifactStorage` already abstracts storage, so the Blob adapter drops in behind it. Requires explicit owner approval, as does any cloud provisioning. |

## Rules that keep this order honest

- **Rebase before you start anything.** Branch drift already cost a day: a branch four
  commits behind `main` presented merged fixes as live bugs (#29).
- **Verify the issue before working it.** Of seventeen issues open on the morning of
  2026-08-07, four were already delivered and two were half-delivered. Check the code
  first.
- **Do not run host-side worker tests against a demo stack** unless the fix from #34 is
  in your checkout — older checkouts wedge the container while still reporting healthy.
- **Owner gates are not sequencing suggestions.** Source classification, external import,
  live scraper runs, deployment and cloud provisioning each need explicit approval
  regardless of where they fall in this list.
