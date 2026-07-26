"use client";

import { createContext, useContext } from "react";
import type { Role } from "./portal-state";

export type PortalActor = {
  userId: string;
  memberId: number | string;
  email: string;
  name: string;
  initials: string;
  role: Role;
};

export type LegacyPortalActor = Omit<PortalActor, "memberId"> & {
  memberId: number;
};

const PortalActorContext = createContext<PortalActor | null>(null);

export function PortalActorProvider({ actor, children }: { actor: PortalActor | null; children: React.ReactNode }) {
  return <PortalActorContext.Provider value={actor}>{children}</PortalActorContext.Provider>;
}

export function usePortalActor() {
  return useContext(PortalActorContext);
}
