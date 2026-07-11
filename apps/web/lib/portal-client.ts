import { readPortalPreference } from "./portal-state";

export function actorHeaders() {
  const actor = readPortalPreference("fgp_user", { name: "Tlangelani Mkhabela", role: "Treasurer" });
  return { "Content-Type": "application/json", "x-fgp-user": actor.name, "x-fgp-role": actor.role };
}
