"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { PortalChrome } from "./PortalChrome";
import {
  readColourModePreference,
  readVisualDirectionPreference,
  type Role,
  type ColourMode,
  type VisualDirection,
} from "@/lib/portal-state";
import { PortalActorProvider, type PortalActor } from "@/lib/portal-actor";
import { useSession } from "@/lib/session-context";

type Project = { id: number; name: string; status: string };

const authPaths = new Set([
  "/login",
  "/sign-in",
  "/register",
  "/verify-email",
  "/password-recovery",
  "/password-reset",
]);

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AppShell({ projects, children }: { projects: Project[]; children?: React.ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const [colourMode, setColourMode] = useState<ColourMode>("light");
  const [visualDirection, setVisualDirection] = useState<VisualDirection>("classic");
  const [appearanceReady, setAppearanceReady] = useState(false);

  useEffect(() => {
    const savedColourMode = readColourModePreference();
    const savedVisualDirection = readVisualDirectionPreference();
    document.documentElement.dataset.mode = savedColourMode;
    document.documentElement.dataset.dir = savedVisualDirection;
    const adoptionTimer = window.setTimeout(() => {
      setColourMode(savedColourMode);
      setVisualDirection(savedVisualDirection);
      setAppearanceReady(true);
    }, 0);
    return () => window.clearTimeout(adoptionTimer);
  }, []);

  function handleColourModeChange(nextMode: ColourMode) {
    setColourMode(nextMode);
    document.documentElement.dataset.mode = nextMode;
  }

  function handleVisualDirectionChange(nextDirection: VisualDirection) {
    setVisualDirection(nextDirection);
    document.documentElement.dataset.dir = nextDirection;
  }

  const actor: PortalActor | null =
    session.status === "authenticated" &&
    session.membershipId &&
    session.user &&
    session.activeOrganization
      ? {
          userId: session.user.id,
          memberId: session.membershipId,
          email: session.user.email,
          name: session.user.displayName,
          initials: initialsFor(session.user.displayName),
          role: session.activeOrganization.role as Role,
        }
      : null;

  if (authPaths.has(pathname) || pathname.startsWith("/invitations/")) {
    return <PortalActorProvider actor={actor}>{children}</PortalActorProvider>;
  }
  return <PortalActorProvider actor={actor}>
    <div className="portal-app" data-mode={appearanceReady ? colourMode : undefined} data-dir={appearanceReady ? visualDirection : undefined}>
      <Sidebar projects={projects} />
      <div className="portal-main">
        <PortalChrome
          colourMode={colourMode}
          visualDirection={visualDirection}
          appearanceReady={appearanceReady}
          onColourModeChange={handleColourModeChange}
          onVisualDirectionChange={handleVisualDirectionChange}
        />
        <main className="portal-scroll">{children}</main>
      </div>
    </div>
  </PortalActorProvider>;
}
