"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { writePortalPreference, type VisualMode } from "@/lib/portal-state";
import { createClient } from "@/lib/supabase";
import { usePortalActor } from "@/lib/portal-actor";
import { PortalIcon } from "./PortalIcon";

const labels: Record<string, string> = {
  "/": "Dashboard", "/scout": "Scout", "/evaluate": "Evaluate land", "/evaluate/result": "Cost oracle",
  "/projects": "Projects", "/capital": "Capital fund", "/settings/tariffs": "Tariffs", "/settings/scraper": "Scraper jobs", "/settings": "Settings",
};

export function PortalChrome({ mode, onModeChange }: { mode: VisualMode; onModeChange: (mode: VisualMode) => void }) {
  const pathname = usePathname();
  const actor = usePortalActor();
  const [open, setOpen] = useState<"user" | "notifications" | null>(null);
  const [activities, setActivities] = useState<Array<{ title: string; detail: string | null; createdAt: string | null }>>([]);
  const crumb = labels[pathname] ?? (pathname.startsWith("/projects/") ? "Project detail" : "Portal");

  useEffect(() => { fetch("/api/activity").then((response) => response.ok ? response.json() : []).then(setActivities).catch(() => setActivities([])); }, []);

  async function signOut() { await createClient().auth.signOut(); window.location.href = "/login"; }

  return (
    <>
      <header className="portal-topbar">
        <div className="portal-crumbs"><span>First Generation</span><PortalIcon name="chevron_right" className="crumb-chevron" /><strong>{crumb}</strong></div>
        <div className="portal-toolbar">
          <div className="mode-switch" aria-label="Visual direction">
            {(["classic", "navy", "bold"] as VisualMode[]).map((item) => (
              <button key={item} className={mode === item ? "is-active" : ""} onClick={() => { onModeChange(item); writePortalPreference("fgp_visual_mode", item); }}>{item}</button>
            ))}
          </div>
          <button className="icon-button" aria-label="Toggle notifications" onClick={() => setOpen(open === "notifications" ? null : "notifications")}><PortalIcon name="notifications" /><span className="notification-dot" /></button>
          <div className="popover-anchor">
            <button className="user-trigger" aria-label="Open account menu" onClick={() => setOpen(open === "user" ? null : "user")}>
              <span className="avatar">{actor?.initials ?? "?"}</span><span className="role-pill">{actor?.role ?? "No access"}</span><PortalIcon name="expand_more" className="chevron" />
            </button>
            {open === "user" && <div className="popover user-menu"><span className="popover-label">Authenticated workspace member</span>{actor && <div className="user-row"><span className="avatar small">{actor.initials}</span><span><strong>{actor.name}</strong><small>{actor.email}</small></span></div>}<button className="popover-link" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }} onClick={signOut}>Sign out</button></div>}
            {open === "notifications" && <div className="popover notification-menu"><span className="popover-label">Activity</span>{activities.length ? activities.slice(0, 5).map((activity) => <div className="activity-row" key={`${activity.title}-${activity.createdAt}`}><PortalIcon name="trending_up" className="activity-icon" /><span><strong>{activity.title}</strong><small>{activity.detail ?? "Workspace activity"}</small></span></div>) : <div className="activity-row"><PortalIcon name="notifications_none" className="activity-icon" /><span><strong>No activity yet</strong><small>Workspace changes will appear here</small></span></div>}<Link href="/projects" className="popover-link" onClick={() => setOpen(null)}>View projects</Link></div>}
          </div>
        </div>
      </header>
      {actor?.role === "Viewer" && <div className="viewer-banner"><PortalIcon name="lock" /> Viewing as {actor.name} · Viewer — read-only.</div>}
    </>
  );
}
