import { NextResponse } from "next/server";
import type { Role } from "./portal-state";
import { createServerSupabase } from "./supabase-server";
import { db, teamMembers } from "@fgp/database";
import { eq, or } from "drizzle-orm";

export const roleCapabilities: Record<Role, string[]> = {
  Owner: ["record", "project", "tariff", "settings", "team", "cosign", "proposal"],
  Chairperson: ["record", "project", "tariff", "settings", "team", "cosign"],
  Treasurer: ["record", "project", "tariff", "settings", "cosign", "proposal"],
  Analyst: ["record", "project", "settings", "cosign"],
  Viewer: [],
};

export async function getAuthenticatedActor() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const email = data.user.email?.toLowerCase() ?? "";
  const [storedMember] = await db.select().from(teamMembers).where(or(eq(teamMembers.userId, data.user.id), eq(teamMembers.email, email))).limit(1);
  const knownMember = storedMember ?? Object.entries({
    "tlangelani@fgproperties.co.za": { name: "Tlangelani Mkhabela", role: "Treasurer" as Role },
    "thabo@fgproperties.co.za": { name: "Thabo Nkosi", role: "Chairperson" as Role },
    "lerato@fgproperties.co.za": { name: "Lerato Dube", role: "Analyst" as Role },
    "mpho@fgproperties.co.za": { name: "Mpho Molefe", role: "Viewer" as Role },
  }).find(([memberEmail]) => memberEmail === email)?.[1];
  return {
    userId: data.user.id,
    email,
    name: knownMember?.name ?? data.user.user_metadata?.full_name ?? email,
    role: (knownMember?.role ?? "Viewer") as Role,
  };
}

export async function requireSessionCapability(capability: string) {
  const actor = await getAuthenticatedActor();
  if (!actor) return { actor: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (!roleCapabilities[actor.role].includes(capability)) return { actor: null, response: NextResponse.json({ error: `${actor.role} cannot ${capability}` }, { status: 403 }) };
  return { actor, response: null };
}
