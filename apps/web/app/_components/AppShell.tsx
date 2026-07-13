"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PortalChrome } from "./PortalChrome";
import {
  readPortalPreference,
  type ColourMode,
  type VisualDirection,
} from "@/lib/portal-state";
import { PortalActorProvider, type PortalActor } from "@/lib/portal-actor";

type Project = { id: number; name: string; status: string };

export function AppShell({ actor, projects, children }: { actor: PortalActor | null; projects: Project[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [colourMode, setColourMode] = useState<ColourMode>(() => readPortalPreference("fgp_colour_mode", "light"));
  const [visualDirection, setVisualDirection] = useState<VisualDirection>(() => readPortalPreference("fgp_visual_direction", "classic"));

  useEffect(() => {
    document.documentElement.dataset.mode = colourMode;
    document.documentElement.dataset.dir = visualDirection;
  }, [colourMode, visualDirection]);

  if (pathname === "/login") return <PortalActorProvider actor={actor}>{children}</PortalActorProvider>;
  return <PortalActorProvider actor={actor}>
    <div className="portal-app" data-mode={colourMode} data-dir={visualDirection}>
      <Sidebar projects={projects} />
      <div className="portal-main">
        <PortalChrome
          colourMode={colourMode}
          visualDirection={visualDirection}
          onColourModeChange={setColourMode}
          onVisualDirectionChange={setVisualDirection}
        />
        <main className="portal-scroll">{children}</main>
      </div>
    </div>
  </PortalActorProvider>;
}
