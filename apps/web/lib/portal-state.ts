export { formatZar } from "./format";

export type Role = "Owner" | "Chairperson" | "Treasurer" | "Analyst" | "Viewer";
export const COLOUR_MODE_PREFERENCE_KEY = "fgp_colour_mode";
export const VISUAL_DIRECTION_PREFERENCE_KEY = "fgp_visual_direction";
export const COLOUR_MODES = ["light", "dark"] as const;
export const VISUAL_DIRECTIONS = ["classic", "navy", "bold"] as const;
export type ColourMode = (typeof COLOUR_MODES)[number];
export type VisualDirection = (typeof VISUAL_DIRECTIONS)[number];

export function isColourMode(value: unknown): value is ColourMode {
  return typeof value === "string" && (COLOUR_MODES as readonly string[]).includes(value);
}

export function isVisualDirection(value: unknown): value is VisualDirection {
  return typeof value === "string" && (VISUAL_DIRECTIONS as readonly string[]).includes(value);
}

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

export function readPortalPreference<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed: unknown = JSON.parse(value);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function readColourModePreference(): ColourMode {
  return readPortalPreference(COLOUR_MODE_PREFERENCE_KEY, "light", isColourMode);
}

export function readVisualDirectionPreference(): VisualDirection {
  return readPortalPreference(VISUAL_DIRECTION_PREFERENCE_KEY, "classic", isVisualDirection);
}

export function writePortalPreference<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are optional; a restricted browser must not break the portal.
  }
}
