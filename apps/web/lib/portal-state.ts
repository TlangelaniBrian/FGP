"use client";

export { formatZar } from "./format";

export type Role = "Owner" | "Chairperson" | "Treasurer" | "Analyst" | "Viewer";
export type VisualMode = "classic" | "navy" | "bold";

export const team = [
  { name: "Tlangelani Mkhabela", initials: "TM", role: "Treasurer" as Role, email: "tlangelani@fgproperties.co.za" },
  { name: "Thabo Nkosi", initials: "TN", role: "Chairperson" as Role, email: "thabo@fgproperties.co.za" },
  { name: "Lerato Dube", initials: "LD", role: "Analyst" as Role, email: "lerato@fgproperties.co.za" },
  { name: "Mpho Molefe", initials: "MM", role: "Viewer" as Role, email: "mpho@fgproperties.co.za" },
];

export const permissions: Record<Role, string[]> = {
  Owner: ["record", "project", "tariff", "settings", "team", "cosign", "proposal"],
  Chairperson: ["record", "project", "tariff", "settings", "team", "cosign"],
  Treasurer: ["record", "project", "tariff", "settings", "cosign", "proposal"],
  Analyst: ["record", "project", "settings", "cosign"],
  Viewer: [],
};

export function can(role: Role, capability: string) {
  return permissions[role].includes(capability);
}

export function readPortalPreference<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePortalPreference<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are optional; a restricted browser must not break the portal.
  }
}
