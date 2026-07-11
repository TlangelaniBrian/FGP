import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, complianceDocuments } from "@fgp/database";
import { requireSessionCapability } from "@/lib/portal-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSessionCapability("project");
  if (guard.response) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json() as { status?: string; pdfUrl?: string };
  if (!body.status || !["draft", "ready", "submitted", "approved", "rejected"].includes(body.status)) return NextResponse.json({ error: "invalid status" }, { status: 422 });
  const [row] = await db.update(complianceDocuments).set({ status: body.status, pdfUrl: body.pdfUrl, submittedAt: body.status === "submitted" ? new Date() : undefined }).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.userId, guard.actor!.userId))).returning();
  if (!row) return NextResponse.json({ error: "document not found" }, { status: 404 });
  return NextResponse.json(row);
}
