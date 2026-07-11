import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Role } from "./portal-state";

export const roleCapabilities: Record<Role, string[]> = {
  Owner: ["record", "project", "tariff", "settings", "team", "cosign", "proposal"],
  Chairperson: ["record", "project", "tariff", "settings", "team", "cosign"],
  Treasurer: ["record", "project", "tariff", "settings", "cosign", "proposal"],
  Analyst: ["record", "project", "settings", "cosign"],
  Viewer: [],
};

const validActors: Record<string, Role> = {
  "Tlangelani Mkhabela": "Treasurer",
  "Thabo Nkosi": "Chairperson",
  "Lerato Dube": "Analyst",
  "Mpho Molefe": "Viewer",
};

export function getActor(req: NextRequest) {
  const name = req.headers.get("x-fgp-user") ?? "Tlangelani Mkhabela";
  const role = validActors[name];
  if (!role || req.headers.get("x-fgp-role") && req.headers.get("x-fgp-role") !== role) return null;
  return { name, role };
}

export function requireCapability(req: NextRequest, capability: string) {
  const actor = getActor(req);
  if (!actor) return { actor: null, response: NextResponse.json({ error: "Invalid portal actor" }, { status: 401 }) };
  if (!roleCapabilities[actor.role].includes(capability)) return { actor: null, response: NextResponse.json({ error: `${actor.role} cannot ${capability}` }, { status: 403 }) };
  return { actor, response: null };
}
