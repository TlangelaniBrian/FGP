"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actorHeaders } from "@/lib/portal-client";
import { can } from "@/lib/portal-state";
import { usePortalActor } from "@/lib/portal-actor";

type DetailKind = "budget" | "contact" | "decision" | "milestone";

export function ProjectDetailEditor({ projectId }: { projectId: number }) {
  const router = useRouter();
  const actor = usePortalActor();
  const [kind, setKind] = useState<DetailKind>("budget");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can(actor?.role ?? "Viewer", "project");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(null);
    const body = kind === "budget"
      ? { action: kind, category: "general", item: primary, totalCost: Number(amount || 0) }
      : kind === "contact"
        ? { action: kind, role: primary, name: secondary }
        : kind === "decision"
          ? { action: kind, decidedAt: date, decision: primary, rationale: secondary }
          : { action: kind, targetDate: date, milestone: primary, owner: secondary };
    const response = await fetch(`/api/projects/${projectId}/details`, { method: "POST", headers: actorHeaders(), body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setMessage(payload.error ? JSON.stringify(payload.error) : "Could not save project detail"); return; }
    setPrimary(""); setSecondary(""); setAmount(""); setMessage(`${kind} detail saved.`); router.refresh();
  }

  const primaryLabel = kind === "budget" ? "Budget item" : kind === "contact" ? "Role" : kind === "decision" ? "Decision" : "Milestone";
  const secondaryLabel = kind === "contact" ? "Name" : kind === "decision" ? "Rationale" : kind === "milestone" ? "Owner" : "Description";
  if (!canEdit) return null;
  return <section className="card card-pad"><div className="split"><div><span className="card-kicker">Project operations</span><h2 className="card-title" style={{ marginTop: 6 }}>Add a live detail</h2></div><span className="tag tag-blue">Persisted</span></div><form onSubmit={save} className="form-grid" style={{ marginTop: 14 }}><select className="field" value={kind} onChange={(event) => setKind(event.target.value as DetailKind)}><option value="budget">Budget item</option><option value="contact">Project contact</option><option value="decision">Decision log</option><option value="milestone">Milestone</option></select><label className="field-label">{primaryLabel}<input className="field" value={primary} onChange={(event) => setPrimary(event.target.value)} required /></label>{kind === "budget" && <label className="field-label">Amount (ZAR)<input className="field" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>}{kind !== "budget" && <label className="field-label">{secondaryLabel}<input className="field" value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label>}{(kind === "decision" || kind === "milestone") && <label className="field-label">{kind === "decision" ? "Decision date" : "Target date"}<input className="field" type={kind === "decision" ? "date" : "text"} value={date} onChange={(event) => setDate(event.target.value)} required /></label>}<button className="button button-secondary" disabled={saving}>{saving ? "Saving…" : "Save detail"}</button></form>{message && <small className="muted" style={{ display: "block", marginTop: 10 }}>{message}</small>}</section>;
}
