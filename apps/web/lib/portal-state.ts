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
