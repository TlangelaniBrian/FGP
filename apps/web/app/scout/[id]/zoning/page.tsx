"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { actorHeaders } from "@/lib/portal-client";
import { usePortalActor } from "@/lib/portal-actor";
import { can } from "@/lib/portal-state";

const steps = ["Confirm current zoning certificate", "Prepare dolomite declaration", "Submit building plan checklist", "Compile pre-application motivation"];
const docs = ["zoning_certificate", "dolomite_declaration", "building_plan_checklist", "motivation_letter"];
const statuses = ["draft", "ready", "submitted", "approved", "rejected"];
type Document = { id: number; docType: string; status: string; pdfUrl?: string | null };
type Listing = { address: string | null; municipality: string | null; zoneCode: string | null; dolomiteRisk: string | null; parcelId: number | null };

export default function ZoningPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = usePortalActor();
  const canEdit = can(actor?.role ?? "Viewer", "project");
  const [id, setId] = useState("parcel");
  const [listing, setListing] = useState<Listing | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const readyCount = useMemo(() => documents.filter((document) => ["ready", "submitted", "approved"].includes(document.status)).length, [documents]);

  useEffect(() => {
    params.then(({ id: value }) => {
      setId(value);
      fetch(`/api/listings?id=${value}`).then((response) => response.ok ? response.json() : []).then((rows: Listing[]) => setListing(rows[0] ?? null));
      fetch(`/api/documents?listingId=${value}`).then((response) => response.ok ? response.json() : []).then(setDocuments);
    });
  }, [params]);

  async function generate() {
    const response = await fetch("/api/documents", { method: "POST", headers: actorHeaders(), body: JSON.stringify({ listingId: Number(id), municipality: listing?.municipality, forms: docs, prefilledData: { address: listing?.address, parcelId: listing?.parcelId, zoneCode: listing?.zoneCode, dolomiteRisk: listing?.dolomiteRisk, municipality: listing?.municipality } }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "Could not generate documents"); return; }
    try {
      const generated = await Promise.all((body as Document[]).map(generateDocument));
      setDocuments(generated);
      setMessage("Compliance documents generated and saved as ready.");
    } catch (error) {
      setDocuments(body);
      setMessage(error instanceof Error ? error.message : "Could not generate document PDFs");
    }
  }

  async function generateDocument(document: Document) {
    const response = await fetch(`/api/documents/${document.id}/download`, { method: "POST", headers: actorHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `Could not generate ${document.docType.replaceAll("_", " ")}`);
    return body as Document;
  }

  async function generateOne(document: Document) {
    try {
      const generated = await generateDocument(document);
      setDocuments((items) => items.map((item) => item.id === document.id ? generated : item));
      setMessage(`${document.docType.replaceAll("_", " ")} generated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate document PDF");
    }
  }

  async function updateStatus(document: Document, status: string) {
    const response = await fetch(`/api/documents/${document.id}`, { method: "PATCH", headers: actorHeaders(), body: JSON.stringify({ status }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "Could not update document status"); return; }
    setDocuments((items) => items.map((item) => item.id === document.id ? body : item));
    setMessage(`${document.docType.replaceAll("_", " ")} marked ${status}.`);
  }

  return <div className="portal-page">
    <div className="portal-page-head"><div><p className="eyebrow">Listing {id} · Compliance</p><h1 className="page-title">Zoning and forms</h1><p className="page-subtitle">{listing ? `${listing.zoneCode ?? "Zone pending"} · ${listing.municipality ?? "Municipality pending"} · Status tracked in the compliance workspace.` : "Loading persisted listing context…"}</p></div><Link href={`/scout/${id}`} className="button button-quiet">← Back to listing</Link></div>
    {message && <div className="card" style={{ padding: "12px 16px", marginBottom: 16, color: "#16653d", background: "#effaf3", borderColor: "#b9e6c9", fontSize: 12, fontWeight: 800 }}>{message}</div>}
    <div className="grid-2">
      <section className="card card-pad">
        <div className="split"><div><span className="card-kicker">Application checklist</span><h2 className="card-title" style={{ marginTop: 6 }}>Keep the file moving</h2></div><span className="tag tag-blue">{readyCount} ready or filed</span></div>
        <div className="compliance-timeline">{steps.map((step, index) => {
          const document = documents.find((item) => item.docType === docs[index]);
          const complete = document && ["ready", "submitted", "approved"].includes(document.status);
          return <div className="compliance-step" key={step}><span className={complete ? "step-dot complete" : "step-dot"}>{complete ? "✓" : index + 1}</span><div style={{ minWidth: 0, flex: 1 }}><strong>{step}</strong><small>{document ? `Status: ${document.status}` : "Not started"}</small></div>{document ? <div className="split">{canEdit ? <select className="field" aria-label={`Status for ${document.docType}`} style={{ minHeight: 30, width: 118, padding: "0 6px", fontSize: 10 }} value={document.status} onChange={(event) => updateStatus(document, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select> : <span className="tag">Read-only</span>}{document.pdfUrl ? <a className="button button-quiet" style={{ minHeight: 30, padding: "0 9px" }} href={`/api/documents/${document.id}/download`}>PDF</a> : canEdit ? <button className="button button-quiet" style={{ minHeight: 30, padding: "0 9px" }} onClick={() => generateOne(document)}>Generate PDF</button> : null}</div> : <span className="tag">Pending</span>}</div>;
        })}</div>
      </section>
      <section className="stack">
        <section className="card card-pad"><span className="card-kicker">Persisted zoning context</span><h2 className="card-title" style={{ marginTop: 6 }}>{listing?.zoneCode ?? "Zone pending"}</h2><div className="list-row"><span><strong>Municipality</strong><small>{listing?.municipality ?? "Not linked"}</small></span><span className="tag tag-blue">Source listing</span></div><div className="list-row"><span><strong>Dolomite risk</strong><small>{listing?.dolomiteRisk ?? "Not analysed"}</small></span><span className="tag tag-green">Live record</span></div><div className="list-row"><span><strong>Parcel</strong><small>{listing?.parcelId ? `#${listing.parcelId}` : "Not linked yet"}</small></span><span className="tag tag-blue">PostGIS</span></div></section>
        <section className="card card-pad"><span className="card-kicker">Generated documents</span><h2 className="card-title" style={{ marginTop: 6 }}>{documents.length ? `${documents.length} documents saved` : "Compliance package"}</h2><p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Generate a working pack, download each PDF, and update its submitted or approved state as the application moves.</p>{canEdit && <button className="button button-primary" style={{ width: "100%", marginTop: 8 }} onClick={generate}>Generate package</button>}</section>
      </section>
    </div>
  </div>;
}
