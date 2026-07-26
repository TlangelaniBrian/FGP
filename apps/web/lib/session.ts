export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
};

export const ORGANIZATION_ROLES = [
  "Owner",
  "Chairperson",
  "Treasurer",
  "Analyst",
  "Viewer",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type AuthSessionOrganization = {
  id: string;
  name: string;
  role: OrganizationRole;
};

export type AuthSession = {
  membershipId: string;
  user: AuthSessionUser;
  activeOrganization: AuthSessionOrganization;
  capabilities: string[];
};

export async function sessionFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("Session requests must use a relative /api/ URL.");
  }

  const headers = new Headers(init.headers);
  if (headers.has("Authorization")) {
    throw new Error("Session requests must use the HTTP-only session cookie.");
  }

  return fetch(path, {
    ...init,
    credentials: "same-origin",
  });
}

export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/u.test(value)
  ) {
    return "/";
  }

  try {
    const base = new URL("https://fgp.local");
    const target = new URL(value, base);
    return target.origin === base.origin ? value : "/";
  } catch {
    return "/";
  }
}

export function decodeIdentityToken(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

export async function apiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "title" in body &&
    typeof body.title === "string"
  ) {
    return body.title;
  }
  return fallback;
}
