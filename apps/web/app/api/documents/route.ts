import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, complianceDocuments } from "@fgp/database";
import { requireCapability } from "@/lib/portal-auth";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const listingId = Number(params.get("listingId"));
  const reportId = Number(params.get("reportId"));
  const rows = Number.isFinite(listingId) && listingId > 0
    ? await db.select().from(complianceDocuments).where(eq(complianceDocuments.listingId, listingId)).orderBy(desc(complianceDocuments.createdAt))
    : Number.isFinite(reportId) && reportId > 0
      ? await db.select().from(complianceDocuments).where(eq(complianceDocuments.reportId, reportId)).orderBy(desc(complianceDocuments.createdAt))
      : await db.select().from(complianceDocuments).orderBy(desc(complianceDocuments.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = requireCapability(req, "project");
  if (guard.response) return guard.response;
  const body = await req.json() as { reportId?: number; listingId?: number; municipality?: string; forms?: string[]; prefilledData?: Record<string, unknown> };
  if (!body.forms?.length || (!body.reportId && !body.listingId)) return NextResponse.json({ error: "forms and reportId or listingId are required" }, { status: 422 });
  const rows = await db.insert(complianceDocuments).values(body.forms.map((docType) => ({ reportId: body.reportId, listingId: body.listingId, municipality: body.municipality, docType, status: "ready", prefilledData: body.prefilledData ?? {} }))).returning();
  return NextResponse.json(rows, { status: 201 });
}
