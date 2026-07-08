# Scheduled Shortcut — `fgp-daily-scraper-run`

Prepared definition for a recurring Cowork/Claude scheduled task. The backend
`set_scheduled_task` tool was **not available** in the session that drafted this,
so the task was not created live — use this spec to create it via the shortcut
UI (or re-run the `create-shortcut` skill once the scheduling tool is wired up).

| Field | Value |
|---|---|
| taskName | `fgp-daily-scraper-run` |
| cron | `0 4 * * *` |
| Schedule (human) | Daily at 04:00 UTC = **06:00 SAST (UTC+2)** |
| Type | Recurring |

> Note on timezone: `0 4 * * *` assumes the scheduler runs in **UTC**. If your
> scheduler uses local SAST time instead, change the cron to `0 6 * * *`.

## Prompt (self-contained)

```
Objective: Run the daily lead-scraping pipeline for the First Generation Properties (FGP) platform and report new high-potential vacant-land listings.

Context: FGP is a property-development feasibility monorepo in the connected workspace folder (typically named "FGP"; path looks like /sessions/<id>/mnt/FGP). The scraper network is "Phase 5" of the project and may NOT be implemented yet. Per the project's CLAUDE.md, the intended design is: a FastAPI worker (apps/worker) exposing POST /scrape/* endpoints (property24, private_property, propdata, gumtree, immo_africa, entegral); a Next.js API route POST /api/scrape/trigger that queues jobs; Playwright scraper classes under scripts/scrapers/; a Celery + Redis task queue; and a scrape_jobs table that records each run.

Steps:
1. Locate the FGP project root in the connected workspace folder.
2. Check whether the scraper pipeline actually exists by looking for ALL of: a scripts/scrapers/ directory containing scraper classes; a /scrape route registered in apps/worker/routers/ or apps/worker/main.py; and an /api/scrape/trigger route under apps/web/app/api/.
3. If the scraper IS implemented: trigger a scrape run for the Midrand and Pretoria pilot areas (listing_type vacant_land, size 300-5000 sqm, price R200,000-R5,000,000) using the project's documented mechanism — prefer POST /api/scrape/trigger if the web app is reachable, otherwise invoke the scraper scripts directly. Wait for completion, then read the scrape_jobs and listings tables (or the job output) and produce a concise summary of newly found listings, explicitly highlighting any with a high feasibility_score.
4. If the scraper is NOT implemented yet: do NOT fabricate any results. Report clearly that "the FGP scraper (Phase 5) is not yet implemented", list exactly which expected components are missing, and stop.

Constraints:
- Read-only / trigger-only: do not write, commit, or modify code or configuration in this run.
- Do not send any emails, messages, or notifications — produce the summary only as this run's output.
- Target market is Gauteng, South Africa (Midrand + Pretoria pilot).

Success criteria: Either (a) a concise summary of newly scraped listings with counts and any high-score leads, or (b) a clear "Phase 5 scraper not yet implemented — missing: <components>" report.
```

## Why the prompt checks for the scraper first

Phase 5 (the scraper network) is not built yet in the current codebase:
no `scripts/scrapers/` directory, no `/scrape/*` worker routes (only
`feasibility` and `parcel`), no `/api/scrape/trigger`, and no Celery queue.
The `scrape_jobs` table exists in the schema but nothing populates it.

Until Phase 5 ships, each scheduled run will safely report
"not yet implemented" rather than do nothing silently or invent results.
Once the scraper exists, the same prompt will trigger it without changes.
