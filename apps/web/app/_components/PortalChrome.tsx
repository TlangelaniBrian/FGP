"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { can, readPortalPreference, team, writePortalPreference, type Role, type VisualMode } from "@/lib/portal-state";

const labels: Record<string, string> = {
  "/": "Dashboard", "/scout": "Scout", "/evaluate": "Evaluate land", "/evaluate/result": "Cost oracle",
  "/projects": "Projects", "/capital": "Capital fund", "/settings/tariffs": "Tariffs", "/settings": "Settings",
};

export function PortalChrome({ mode, onModeChange }: { mode: VisualMode; onModeChange: (mode: VisualMode) => void }) {
  const pathname = usePathname();
  const [current, setCurrent] = useState(() => readPortalPreference("fgp_user", team[0]));
  const [open, setOpen] = useState<"user" | "notifications" | null>(null);
  const crumb = labels[pathname] ?? (pathname.startsWith("/projects/") ? "Project detail" : "Portal");

  useEffect(() => writePortalPreference("fgp_user", current), [current]);

  function switchUser(person: (typeof team)[number]) {
    setCurrent(person);
    setOpen(null);
  }

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
            {open === "user" && <div className="popover user-menu"><span className="popover-label">Signed in as · switch user</span>{team.map((person) => <button key={person.email} className="user-row" onClick={() => switchUser(person)}><span className="avatar small">{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span>{person.email === current.email && <span className="check">✓</span>}</button>)}</div>}
            {open === "notifications" && <div className="popover notification-menu"><span className="popover-label">Activity</span><div className="activity-row"><span className="activity-icon">↗</span><span><strong>New feasibility report ready</strong><small>42 minutes ago</small></span></div><div className="activity-row"><span className="activity-icon">R</span><span><strong>Contribution recorded</strong><small>Yesterday</small></span></div><Link href="/projects" className="popover-link" onClick={() => setOpen(null)}>View all activity</Link></div>}
          </div>
        </div>
      </header>
      {current.role === "Viewer" && <div className="viewer-banner">⌑ Viewing as {current.name} · Viewer — read-only. Switch user from the top-right to make changes.</div>}
      {!can(current.role as Role, "record") && current.role !== "Viewer" && null}
    </>
  );
}
