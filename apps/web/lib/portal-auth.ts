import { NextResponse } from "next/server";
import type { Role } from "./portal-state";
import { createServerSupabase } from "./supabase-server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db, teamMembers } from "@fgp/database";
import { and, eq, or } from "drizzle-orm";
import type { PortalActor } from "./portal-actor";

export const roleCapabilities: Record<Role, string[]> = {
  Owner: ["record", "project", "tariff", "settings", "team", "cosign", "proposal"],
  Chairperson: ["record", "project", "tariff", "settings", "team", "cosign"],
  Treasurer: ["record", "project", "tariff", "settings", "cosign", "proposal"],
  Analyst: ["record", "project", "settings", "cosign"],
  Viewer: [],
};

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export async function getAuthenticatedActor(request?: Request): Promise<PortalActor | null> {
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const authClient = bearer
    ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    : await createServerSupabase();
  const { data, error } = await authClient.auth.getUser(bearer);
  if (error || !data.user) return null;
  const email = data.user.email?.toLowerCase() ?? "";
  const [storedMember] = await db.select().from(teamMembers).where(and(
    or(eq(teamMembers.userId, data.user.id), eq(teamMembers.email, email)),
    eq(teamMembers.status, "active"),
  )).limit(1);
  if (!storedMember) return null;
  return {
    userId: data.user.id,
    email,
    name: storedMember.name,
    initials: initialsFor(storedMember.name),
    role: storedMember.role as Role,
  };
}

export async function requireSessionCapability(capability: string, request?: Request) {
  const actor = await getAuthenticatedActor(request);
  if (!actor) return { actor: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  if (!roleCapabilities[actor.role].includes(capability)) return { actor: null, response: NextResponse.json({ error: `${actor.role} cannot ${capability}` }, { status: 403 }) };
  return { actor, response: null };
}
