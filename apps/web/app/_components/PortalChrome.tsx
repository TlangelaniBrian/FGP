"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  writePortalPreference,
  type ColourMode,
  type VisualDirection,
} from "@/lib/portal-state";
import { createClient } from "@/lib/supabase";
import { usePortalActor } from "@/lib/portal-actor";
import { PortalIcon } from "./PortalIcon";

const labels: Record<string, string> = {
  "/": "Dashboard", "/scout": "Scout", "/evaluate": "Evaluate land", "/evaluate/result": "Cost oracle",
  "/projects": "Projects", "/capital": "Capital fund", "/settings/tariffs": "Tariffs", "/settings/scraper": "Scraper jobs", "/settings": "Settings",
};

type PortalChromeProps = {
  colourMode: ColourMode;
  visualDirection: VisualDirection;
  appearanceReady: boolean;
  onColourModeChange: (mode: ColourMode) => void;
  onVisualDirectionChange: (direction: VisualDirection) => void;
};

export function PortalChrome({ colourMode, visualDirection, appearanceReady, onColourModeChange, onVisualDirectionChange }: PortalChromeProps) {
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
          {appearanceReady ? <>
          <div className="mode-switch" role="group" aria-label="Visual direction">
            {(["classic", "navy", "bold"] as VisualDirection[]).map((item) => (
              <button
                key={item}
                type="button"
                className={visualDirection === item ? "is-active" : ""}
                aria-label={`Use ${item} visual direction`}
                aria-pressed={visualDirection === item}
                onClick={() => {
                  onVisualDirectionChange(item);
                  writePortalPreference("fgp_visual_direction", item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button colour-mode-button"
            aria-label="Dark colour mode"
            aria-pressed={colourMode === "dark"}
            onClick={() => {
              const nextMode: ColourMode = colourMode === "dark" ? "light" : "dark";
              onColourModeChange(nextMode);
              writePortalPreference("fgp_colour_mode", nextMode);
            }}
          >
            <PortalIcon name={colourMode === "dark" ? "light_mode" : "dark_mode"} />
          </button>
          </> : <div className="appearance-controls-placeholder" aria-hidden="true">
            <div className="mode-switch"><button tabIndex={-1}>classic</button><button tabIndex={-1}>navy</button><button tabIndex={-1}>bold</button></div>
            <span className="icon-button colour-mode-button"><PortalIcon name="dark_mode" /></span>
          </div>}
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
