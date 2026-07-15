import { NextRequest, NextResponse } from "next/server";
import { db, feasibilityReports, listings, projects } from "@fgp/database";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const actor = await getAuthenticatedActor(req);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { searchParams } = new URL(req.url);

  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, actor.userId))
    .orderBy(desc(projects.createdAt))
    .limit(limit)
    .offset(offset);

  // When paginated explicitly, return an envelope with total; otherwise keep the
  // bare-array shape the sidebar/layout already consumes (backwards compatible).
  if (searchParams.has("limit") || searchParams.has("offset")) {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.userId, actor.userId));
    return NextResponse.json({ projects: rows, total, limit, offset });
  }

  return NextResponse.json(rows);
}

const createSchema = z.object({
  listingId: z.number().int().positive(),
  reportId: z.number().int().positive(),
  name: z.string().min(2).max(120),
  status: z.enum(["planning", "compliance", "approved", "construction", "complete", "stalled"]).default("planning"),
  notes: z.string().max(5000).optional(),
  phase1TargetZar: z.number().nonnegative().optional(),
  monthlySavingZar: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("project", req);
  if (guard.response) return guard.response;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const data = parsed.data;
  const [ownedListing, ownedReport] = await Promise.all([
    db.select({ id: listings.id }).from(listings).where(and(eq(listings.id, data.listingId), eq(listings.userId, guard.actor!.userId))).limit(1),
    db.select({ id: feasibilityReports.id }).from(feasibilityReports).where(and(eq(feasibilityReports.id, data.reportId), eq(feasibilityReports.userId, guard.actor!.userId))).limit(1),
  ]);
  if (!ownedListing[0] || !ownedReport[0]) return NextResponse.json({ error: "listing or feasibility report not found" }, { status: 404 });
  const [row] = await db.insert(projects).values({
    listingId: data.listingId,
    reportId: data.reportId,
    name: data.name,
    status: data.status,
    notes: data.notes,
    phase1TargetZar: data.phase1TargetZar == null ? undefined : String(data.phase1TargetZar),
    monthlySavingZar: data.monthlySavingZar == null ? undefined : String(data.monthlySavingZar),
    userId: guard.actor!.userId,
  }).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "project_created", title: `Project created: ${row.name}`, entityType: "project", entityId: row.id });
  return NextResponse.json(row, { status: 201 });
}
