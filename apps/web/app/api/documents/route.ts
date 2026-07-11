import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, complianceDocuments } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { recordActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  if (!await getAuthenticatedActor()) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const listingId = Number(params.get("listingId"));
  const reportId = Number(params.get("reportId"));
  const rows = Number.isFinite(listingId) && listingId > 0
    ? await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.userId, (await getAuthenticatedActor())!.userId), eq(complianceDocuments.listingId, listingId))).orderBy(desc(complianceDocuments.createdAt))
    : Number.isFinite(reportId) && reportId > 0
      ? await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.userId, (await getAuthenticatedActor())!.userId), eq(complianceDocuments.reportId, reportId))).orderBy(desc(complianceDocuments.createdAt))
      : await db.select().from(complianceDocuments).where(eq(complianceDocuments.userId, (await getAuthenticatedActor())!.userId)).orderBy(desc(complianceDocuments.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await requireSessionCapability("project");
  if (guard.response) return guard.response;
  const body = await req.json() as { reportId?: number; listingId?: number; municipality?: string; forms?: string[]; prefilledData?: Record<string, unknown> };
  if (!body.forms?.length || (!body.reportId && !body.listingId)) return NextResponse.json({ error: "forms and reportId or listingId are required" }, { status: 422 });
  const rows = await db.insert(complianceDocuments).values(body.forms.map((docType) => ({ userId: guard.actor!.userId, reportId: body.reportId, listingId: body.listingId, municipality: body.municipality, docType, status: "ready", prefilledData: body.prefilledData ?? {} }))).returning();
  await recordActivity({ actorUserId: guard.actor!.userId, actorName: guard.actor!.name, eventType: "documents_generated", title: "Compliance package generated", detail: `${rows.length} documents`, entityType: "listing", entityId: body.listingId ?? body.reportId });
  return NextResponse.json(rows, { status: 201 });
}
