"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePortalActor } from "@/lib/portal-actor";
import { can } from "@/lib/portal-state";

export function LinkParcelForm({ listingId, parcelId }: { listingId: number; parcelId: number | null }) {
  const router = useRouter();
  const actor = usePortalActor();
  const canEdit = can(actor?.role ?? "Viewer", "record");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function link(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/listings/${listingId}/link-parcel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: Number(lat), lng: Number(lng) }) });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setMessage(typeof body.error === "string" ? body.error : "Could not link this listing to a parcel."); return; }
    setMessage(`Linked to parcel #${body.parcelId}.`);
    router.refresh();
  }

  if (parcelId) return <div className="card status-banner-success" style={{ padding: 14, marginTop: 16 }}><strong>Linked parcel #{parcelId}</strong><small style={{ display: "block", marginTop: 4 }}>Spatial analysis and zoning context are attached to this listing.</small></div>;
  if (!canEdit) return null;
  return <form onSubmit={link} className="card" style={{ padding: 14, marginTop: 16 }}><span className="card-kicker">Parcel link</span><strong style={{ display: "block", marginTop: 5 }}>Attach spatial context</strong><small className="muted" style={{ display: "block", marginTop: 4 }}>Enter the listing coordinate to resolve and persist its PostGIS parcel match.</small><div className="form-grid" style={{ marginTop: 12 }}><input className="field" placeholder="Latitude e.g. -25.99" value={lat} onChange={(event) => setLat(event.target.value)} required /><input className="field" placeholder="Longitude e.g. 28.13" value={lng} onChange={(event) => setLng(event.target.value)} required /></div><button className="button button-secondary" style={{ marginTop: 10 }} disabled={saving}>{saving ? "Linking…" : "Link to parcel"}</button>{message && <small className="muted" style={{ display: "block", marginTop: 8 }}>{message}</small>}</form>;
}
