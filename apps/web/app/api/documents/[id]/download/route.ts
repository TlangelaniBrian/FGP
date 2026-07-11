import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, complianceDocuments } from "@fgp/database";
import { getAuthenticatedActor } from "@/lib/portal-auth";
import { createAdminSupabase } from "@/lib/supabase-admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedActor(_req);
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const [document] = await db.select().from(complianceDocuments).where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.userId, actor.userId)));
  if (!document) return NextResponse.json({ error: "document not found" }, { status: 404 });
  const workerUrl = process.env.WORKER_URL ?? "http://127.0.0.1:8000";
  const generated = await fetch(`${workerUrl}/forms/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc_type: document.docType, context: document.prefilledData ?? { municipality: document.municipality } }) });
  if (!generated.ok) return NextResponse.json({ error: await generated.text() }, { status: 502 });
  const pdf = await generated.arrayBuffer();
  const admin = createAdminSupabase();
  let pdfUrl: string | undefined;
  if (admin) {
    const path = `${actor.userId}/${document.id}-${document.docType}.pdf`;
    const upload = await admin.storage.from("compliance-documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (!upload.error) pdfUrl = admin.storage.from("compliance-documents").getPublicUrl(path).data.publicUrl;
  }
  await db.update(complianceDocuments).set({ pdfUrl, status: "ready" }).where(eq(complianceDocuments.id, id));
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${document.docType}.pdf` } });
}
