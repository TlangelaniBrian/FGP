import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, scrapeJobs } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function GET() {
  if (!await getAuthenticatedActor()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const actor = await getAuthenticatedActor();
  return NextResponse.json(await db.select().from(scrapeJobs).where(eq(scrapeJobs.userId, actor!.userId)).orderBy(desc(scrapeJobs.createdAt)).limit(50));
}

const jobSchema = z.object({ source: z.enum(["property24", "private_property", "propdata", "gumtree", "immo_africa", "entegral"]), location: z.string().min(2).max(120), radiusKm: z.number().positive().max(100).default(20), minSizeSqm: z.number().positive().default(300), maxPrice: z.number().positive().default(5000000) });

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("record");
  if (guard.response) return guard.response;
  const parsed = jobSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const [row] = await db.insert(scrapeJobs).values({ userId: guard.actor!.userId, source: parsed.data.source, searchParams: parsed.data, status: "queued" }).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "scrape_queued", title: `Scrape queued: ${parsed.data.source}`, detail: parsed.data.location, entityType: "scrape_job", entityId: row.id });
  return NextResponse.json(row, { status: 201 });
}
