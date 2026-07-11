"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { can, readPortalPreference, team, writePortalPreference, type Role, type VisualMode } from "@/lib/portal-state";
import { createClient } from "@/lib/supabase";

const labels: Record<string, string> = {
  "/": "Dashboard", "/scout": "Scout", "/evaluate": "Evaluate land", "/evaluate/result": "Cost oracle",
  "/projects": "Projects", "/capital": "Capital fund", "/settings/tariffs": "Tariffs", "/settings/scraper": "Scraper jobs", "/settings": "Settings",
};

export function PortalChrome({ mode, onModeChange }: { mode: VisualMode; onModeChange: (mode: VisualMode) => void }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState(() => readPortalPreference("fgp_user", team[0]));
  const [open, setOpen] = useState<"user" | "notifications" | null>(null);
  const [activities, setActivities] = useState<Array<{ title: string; detail: string | null; createdAt: string | null }>>([]);
  const crumb = labels[pathname] ?? (pathname.startsWith("/projects/") ? "Project detail" : "Portal");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const match = team.find((person) => person.email === data.user.email?.toLowerCase());
      setCurrent(match ?? { name: data.user.user_metadata?.full_name ?? data.user.email ?? "Workspace member", initials: (data.user.email ?? "WM").slice(0, 2).toUpperCase(), role: "Viewer" as Role, email: data.user.email ?? "" });
    });
  }, []);

  useEffect(() => { fetch("/api/activity").then((response) => response.ok ? response.json() : []).then(setActivities).catch(() => setActivities([])); }, []);

  useEffect(() => writePortalPreference("fgp_user", current), [current]);

  async function signOut() { await createClient().auth.signOut(); window.location.href = "/login"; }

  return (
    <>
      <header className="portal-topbar">
        <div className="portal-crumbs"><span>First Generation</span><span className="crumb-chevron">/</span><strong>{crumb}</strong></div>
        <div className="portal-toolbar">
          <div className="mode-switch" aria-label="Visual direction">
            {(["classic", "navy", "bold"] as VisualMode[]).map((item) => (
              <button key={item} className={mode === item ? "is-active" : ""} onClick={() => { onModeChange(item); writePortalPreference("fgp_visual_mode", item); }}>{item}</button>
            ))}
          </div>
          <button className="icon-button" aria-label="Toggle notifications" onClick={() => setOpen(open === "notifications" ? null : "notifications")}>♧<span className="notification-dot" /></button>
          <div className="popover-anchor">
            <button className="user-trigger" onClick={() => setOpen(open === "user" ? null : "user")}>
              <span className="avatar">{current.initials}</span><span className="role-pill">{current.role}</span><span className="chevron">⌄</span>
            </button>
            {open === "user" && <div className="popover user-menu"><span className="popover-label">Authenticated workspace member</span><div className="user-row"><span className="avatar small">{current.initials}</span><span><strong>{current.name}</strong><small>{current.email}</small></span></div><button className="popover-link" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }} onClick={signOut}>Sign out</button></div>}
            {open === "notifications" && <div className="popover notification-menu"><span className="popover-label">Activity</span>{activities.length ? activities.slice(0, 5).map((activity) => <div className="activity-row" key={`${activity.title}-${activity.createdAt}`}><span className="activity-icon">↗</span><span><strong>{activity.title}</strong><small>{activity.detail ?? "Workspace activity"}</small></span></div>) : <div className="activity-row"><span className="activity-icon">·</span><span><strong>No activity yet</strong><small>Workspace changes will appear here</small></span></div>}<Link href="/projects" className="popover-link" onClick={() => setOpen(null)}>View projects</Link></div>}
          </div>
        </div>
      </header>
      {current.role === "Viewer" && <div className="viewer-banner">⌑ Viewing as {current.name} · Viewer — read-only. Switch user from the top-right to make changes.</div>}
      {!can(current.role as Role, "record") && current.role !== "Viewer" && null}
    </>
  );
}
