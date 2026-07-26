"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  sessionFetch,
  ORGANIZATION_ROLES,
  type AuthSession,
  type AuthSessionOrganization,
  type AuthSessionUser,
} from "./session";

export type SessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type SessionContextValue = {
  status: SessionStatus;
  membershipId: string | null;
  user: AuthSessionUser | null;
  activeOrganization: AuthSessionOrganization | null;
  capabilities: string[];
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const unauthenticatedSession: SessionContextValue = {
  status: "unauthenticated",
  membershipId: null,
  user: null,
  activeOrganization: null,
  capabilities: [],
  error: null,
  refresh: async () => {},
  signOut: async () => {},
};

export const SessionContext = createContext<SessionContextValue>(
  unauthenticatedSession,
);

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.user?.id === "string" &&
    typeof candidate.membershipId === "string" &&
    typeof candidate.user.email === "string" &&
    typeof candidate.user.displayName === "string" &&
    typeof candidate.activeOrganization?.id === "string" &&
    typeof candidate.activeOrganization.name === "string" &&
    ORGANIZATION_ROLES.some(
      (role) => role === candidate.activeOrganization?.role,
    ) &&
    Array.isArray(candidate.capabilities) &&
    candidate.capabilities.every(
      (capability) => typeof capability === "string",
    )
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await sessionFetch("/api/auth/session", {
        headers: { Accept: "application/json" },
      });
      if (response.status === 401 || response.status === 403) {
        setSession(null);
        setStatus("unauthenticated");
        return;
      }
      if (!response.ok) {
        throw new Error(`Session request failed (HTTP ${response.status}).`);
      }

      const body: unknown = await response.json();
      if (!isAuthSession(body)) {
        throw new Error("The server returned an invalid session.");
      }
      setSession(body);
      setStatus("authenticated");
    } catch (reason) {
      setSession(null);
      setStatus("error");
      setError(
        reason instanceof Error ? reason.message : "Could not load the session.",
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    await sessionFetch("/api/auth/sign-out", { method: "POST" });
    setSession(null);
    setStatus("unauthenticated");
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      membershipId: session?.membershipId ?? null,
      user: session?.user ?? null,
      activeOrganization: session?.activeOrganization ?? null,
      capabilities: session?.capabilities ?? [],
      error,
      refresh,
      signOut,
    }),
    [error, refresh, session, signOut, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
