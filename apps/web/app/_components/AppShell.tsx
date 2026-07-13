"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PortalChrome } from "./PortalChrome";
import {
  readColourModePreference,
  readVisualDirectionPreference,
  type ColourMode,
  type VisualDirection,
} from "@/lib/portal-state";
import { PortalActorProvider, type PortalActor } from "@/lib/portal-actor";

type Project = { id: number; name: string; status: string };

export function AppShell({ actor, projects, children }: { actor: PortalActor | null; projects: Project[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [colourMode, setColourMode] = useState<ColourMode>("light");
  const [visualDirection, setVisualDirection] = useState<VisualDirection>("classic");

  useEffect(() => {
    const savedColourMode = readColourModePreference();
    const savedVisualDirection = readVisualDirectionPreference();
    document.documentElement.dataset.mode = savedColourMode;
    document.documentElement.dataset.dir = savedVisualDirection;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setColourMode(savedColourMode);
      setVisualDirection(savedVisualDirection);
    });
    return () => { cancelled = true; };
  }, []);

  function handleColourModeChange(nextMode: ColourMode) {
    setColourMode(nextMode);
    document.documentElement.dataset.mode = nextMode;
  }

  function handleVisualDirectionChange(nextDirection: VisualDirection) {
    setVisualDirection(nextDirection);
    document.documentElement.dataset.dir = nextDirection;
  }

  if (pathname === "/login") return <PortalActorProvider actor={actor}>{children}</PortalActorProvider>;
  return <PortalActorProvider actor={actor}>
    <div className="portal-app" data-mode={colourMode} data-dir={visualDirection}>
      <Sidebar projects={projects} />
      <div className="portal-main">
        <PortalChrome
          colourMode={colourMode}
          visualDirection={visualDirection}
          onColourModeChange={handleColourModeChange}
          onVisualDirectionChange={handleVisualDirectionChange}
        />
        <main className="portal-scroll">{children}</main>
      </div>
    </div>
  </PortalActorProvider>;
}
