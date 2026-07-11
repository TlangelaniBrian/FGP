"use client";

import { useState } from "react";
import { actorHeaders } from "@/lib/portal-client";
import { can, readPortalPreference, team, type Role } from "@/lib/portal-state";

export function ProjectActions({ project }: { project: { id: number; name: string; status: string; notes?: string | null } }) {
  const current = readPortalPreference("fgp_user", team[0]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [notes, setNotes] = useState(project.notes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  if (!can(current.role as Role, "project")) return <span className="tag">Read-only</span>;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: actorHeaders(), body: JSON.stringify({ name, status, notes }) });
    const body = await response.json();
    if (!response.ok) { setMessage(body.error ?? "Could not update project"); return; }
    setEditing(false); setMessage("Project updated. Refreshing data will show the saved values.");
  }
  return <div>{message && <span className="muted" style={{ display: "block", marginBottom: 8, fontSize: 11 }}>{message}</span>}{editing ? <form onSubmit={save} className="card" style={{ padding: 16, minWidth: 280 }}><label className="field-label">Project name<input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label" style={{ marginTop: 10 }}>Status<select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>{["planning", "compliance", "approved", "construction", "complete", "stalled"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field-label" style={{ marginTop: 10 }}>Notes<textarea className="field" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="split" style={{ marginTop: 12 }}><button className="button button-primary">Save changes</button><button type="button" className="button button-quiet" onClick={() => setEditing(false)}>Cancel</button></div></form> : <button className="button button-primary" onClick={() => setEditing(true)}>Edit project</button>}</div>;
}
