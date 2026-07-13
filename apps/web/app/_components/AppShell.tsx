"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PortalChrome } from "./PortalChrome";
import { readPortalPreference, type VisualMode } from "@/lib/portal-state";
import { PortalActorProvider, type PortalActor } from "@/lib/portal-actor";

type Project = { id: number; name: string; status: string };

export function AppShell({ actor, projects, children }: { actor: PortalActor | null; projects: Project[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<VisualMode>(() => readPortalPreference("fgp_visual_mode", "classic"));

  useEffect(() => {
    document.documentElement.dataset.mode = "light";
    document.documentElement.dataset.dir = mode;
  }, [mode]);

  if (pathname === "/login") return <PortalActorProvider actor={actor}>{children}</PortalActorProvider>;
  return <PortalActorProvider actor={actor}>
    <div className="portal-app" data-mode="light" data-dir={mode}>
      <Sidebar projects={projects} />
      <div className="portal-main">
        <PortalChrome mode={mode} onModeChange={setMode} />
        <main className="portal-scroll">{children}</main>
      </div>
    </div>
  </PortalActorProvider>;
}
