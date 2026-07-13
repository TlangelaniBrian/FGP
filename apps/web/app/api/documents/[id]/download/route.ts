import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, complianceDocuments } from "@fgp/database";
import { getAuthenticatedActor, requireSessionCapability } from "@/lib/portal-auth";
import { createAdminSupabase } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ id: string }> };

function documentId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function storedObjectPath(value: string) {
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;
  try {
    const marker = "/compliance-documents/";
    const pathname = new URL(value).pathname;
    const markerIndex = pathname.indexOf(marker);
    return markerIndex >= 0 ? decodeURIComponent(pathname.slice(markerIndex + marker.length)) : null;
  } catch {
    return null;
  }
}

function documentObjectPath(userId: string, id: number, docType: string) {
  return `${userId}/${id}-${docType}.pdf`;
}

export async function GET(request: Request, { params }: RouteContext) {
  const actor = await getAuthenticatedActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = documentId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const [document] = await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.userId, actor.userId)));
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });
  if (!document.pdfUrl) return NextResponse.json({ error: "document has not been generated" }, { status: 404 });
  const path = storedObjectPath(document.pdfUrl);
  if (path !== documentObjectPath(actor.userId, document.id, document.docType)) {
    return NextResponse.json({ error: "stored document object path is invalid" }, { status: 422 });
  }
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "document storage is unavailable" }, { status: 503 });
  const signed = await admin.storage.from("compliance-documents").createSignedUrl(path, 60);
  if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 502 });
  return NextResponse.redirect(signed.data.signedUrl);
}

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireSessionCapability("project", request);
  if (guard.response) return guard.response;
  const id = documentId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const [document] = await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.userId, guard.actor!.userId)));
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const workerUrl = process.env.WORKER_URL ?? "http://127.0.0.1:8000";
  const generated = await fetch(`${workerUrl}/forms/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_type: document.docType, context: document.prefilledData ?? { municipality: document.municipality } }),
  });
  if (!generated.ok) return NextResponse.json({ error: await generated.text() }, { status: 502 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "document storage is unavailable" }, { status: 503 });
  const path = documentObjectPath(guard.actor!.userId, document.id, document.docType);
  const upload = await admin.storage.from("compliance-documents").upload(path, await generated.arrayBuffer(), { contentType: "application/pdf", upsert: true });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 502 });
  const [updated] = await db.update(complianceDocuments).set({ pdfUrl: path, status: document.status === "draft" ? "ready" : document.status }).where(eq(complianceDocuments.id, id)).returning();
  return NextResponse.json(updated);
}
