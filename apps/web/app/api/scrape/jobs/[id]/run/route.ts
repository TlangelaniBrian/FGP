import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, listings, portalSettings, scrapeJobs } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSessionCapability("record", req);
  if (guard.response) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const [job] = await db.select().from(scrapeJobs).where(and(eq(scrapeJobs.id, id), eq(scrapeJobs.userId, guard.actor!.userId)));
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  if (job.status === "running") return NextResponse.json({ error: "job already running" }, { status: 409 });
  await db.update(scrapeJobs).set({ status: "running", startedAt: new Date(), errorMessage: null }).where(eq(scrapeJobs.id, id));
  const searchParams = (job.searchParams ?? {}) as { location?: string; radiusKm?: number; minSizeSqm?: number; maxPrice?: number };
  const workerUrl = process.env.WORKER_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${workerUrl}/scrape/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: job.source, location: searchParams.location ?? "Midrand", radius_km: searchParams.radiusKm ?? 20, min_size_sqm: searchParams.minSizeSqm ?? 300, max_price: searchParams.maxPrice ?? 5000000 }) });
  } catch (error) {
    await db.update(scrapeJobs).set({ status: "failed", errorMessage: String(error), completedAt: new Date() }).where(eq(scrapeJobs.id, id));
    return NextResponse.json({ error: "scraper worker unreachable" }, { status: 502 });
  }
  const payload = await response.json().catch(() => ({ listings: [] }));
  if (!response.ok) {
    await db.update(scrapeJobs).set({ status: "failed", errorMessage: String(payload.detail ?? "scraper failed"), completedAt: new Date() }).where(eq(scrapeJobs.id, id));
    return NextResponse.json({ error: payload.detail ?? "scraper failed" }, { status: 502 });
  }
  const thresholdRow = await db.select().from(portalSettings).where(eq(portalSettings.key, "scoreThreshold"));
  const threshold = Number(thresholdRow[0]?.value ?? 75);
  const incoming = Array.isArray(payload.listings) ? payload.listings as Array<Record<string, unknown>> : [];
  const rows = incoming.length ? await db.insert(listings).values(incoming.filter((item) => typeof item.address === "string").map((item) => ({ userId: guard.actor!.userId, source: job.source, address: String(item.address), sizeSqm: item.size_sqm == null ? undefined : String(item.size_sqm), price: item.price == null ? undefined : String(item.price), sourceUrl: typeof item.source_url === "string" ? item.source_url : undefined, description: typeof item.description === "string" ? item.description : undefined, feasibilityScore: null, status: threshold <= 0 ? "analyzed" : "new" }))).returning() : [];
  const [updated] = await db.update(scrapeJobs).set({ status: "complete", listingsFound: incoming.length, listingsNew: rows.length, completedAt: new Date() }).where(eq(scrapeJobs.id, id)).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "scrape_completed", title: `Scrape completed: ${job.source}`, detail: `${rows.length} listings ingested`, entityType: "scrape_job", entityId: id });
  return NextResponse.json({ job: updated, listings: rows });
}
