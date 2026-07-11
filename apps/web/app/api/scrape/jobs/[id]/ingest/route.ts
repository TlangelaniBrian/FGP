import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, listings, portalSettings, scrapeJobs } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

const ingestSchema = z.object({ listings: z.array(z.object({ address: z.string().min(2), suburb: z.string().optional(), municipality: z.enum(["johannesburg", "tshwane", "ekurhuleni"]).optional(), sizeSqm: z.number().positive().optional(), price: z.number().positive().optional(), sourceUrl: z.string().url().optional(), description: z.string().max(5000).optional(), feasibilityScore: z.number().int().min(0).max(100).optional() })).max(500) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSessionCapability("record");
  if (guard.response) return guard.response;
  const jobId = Number((await params).id);
  if (!Number.isInteger(jobId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const [job] = await db.select().from(scrapeJobs).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.userId, guard.actor!.userId)));
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  const parsed = ingestSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const thresholdRow = await db.select().from(portalSettings).where(eq(portalSettings.key, "scoreThreshold"));
  const threshold = Number(thresholdRow[0]?.value ?? 75);
  const rows = parsed.data.listings.length ? await db.insert(listings).values(parsed.data.listings.map((item) => ({ userId: guard.actor!.userId, source: job.source, address: item.address, suburb: item.suburb, municipality: item.municipality, sizeSqm: item.sizeSqm == null ? undefined : String(item.sizeSqm), price: item.price == null ? undefined : String(item.price), sourceUrl: item.sourceUrl, description: item.description, feasibilityScore: item.feasibilityScore, status: item.feasibilityScore != null && item.feasibilityScore >= threshold ? "analyzed" : "new" }))).returning() : [];
  const [updated] = await db.update(scrapeJobs).set({ status: "complete", listingsFound: parsed.data.listings.length, listingsNew: rows.length, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId)).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "scrape_completed", title: `Scrape completed: ${job.source}`, detail: `${rows.length} listings ingested`, entityType: "scrape_job", entityId: jobId });
  return NextResponse.json({ job: updated, listings: rows }, { status: 201 });
}
