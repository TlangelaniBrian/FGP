"use client";
import { useState } from "react";
import { CheckInModal } from "./CheckInModal";
import { can } from "@/lib/portal-state";
import { usePortalActor } from "@/lib/portal-actor";

type Checkin = {
  weekOf: string;
  attorneyStatus: string | null;
  savingsConfirmed: boolean | null;
  supplierProgress: string | null;
  openIssues: string | null;
  actionsNextCall: string | null;
  decisionsNeeded: string | null;
} | null;

export function ThisWeek({ projectId, latestCheckin }: { projectId: number; latestCheckin: Checkin }) {
  const [open, setOpen] = useState(false);
  const actor = usePortalActor();
  const canEdit = can(actor?.role ?? "Viewer", "project");

  const actions = latestCheckin?.actionsNextCall
    ?.split("\n").filter(Boolean)
    ?? ["Follow up with attorney", "Confirm savings deposit", "Get architect quotes"];

  return (
    <div className="bg-bg-surface border border-accent-green/20 rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono text-accent-green tracking-widest uppercase">This Week</p>
        {canEdit && <button
          onClick={() => setOpen(true)}
          className="text-[10px] font-mono border border-border text-text-muted hover:text-text-primary px-3 py-1 rounded-[6px] portal-transition"
        >
          Log check-in
        </button>}
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 border border-accent-amber rounded-[3px] flex-shrink-0" />
            <span className="text-text-primary font-mono text-xs">{action}</span>
          </div>
        ))}
      </div>
      {latestCheckin?.openIssues && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1">Open Issues</p>
          <p className="text-text-muted font-mono text-xs">{latestCheckin.openIssues}</p>
        </div>
      )}
      {canEdit && open && <CheckInModal projectId={projectId} onClose={() => setOpen(false)} />}
    </div>
  );
}
