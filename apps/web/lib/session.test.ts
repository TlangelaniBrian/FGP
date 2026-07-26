import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireSession } from "../app/_components/RequireSession";
import { TariffActions } from "../app/settings/tariffs/_components/TariffActions";
import { AppShell } from "../app/_components/AppShell";
import { usePortalActor } from "./portal-actor";
import {
  SessionContext,
  SessionProvider,
  useSession,
  type SessionContextValue,
} from "./session-context";
import { safeReturnTo, sessionFetch, type AuthSession } from "./session";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace }),
}));

const authenticatedSession: AuthSession = {
  membershipId: "a970f29a-b57f-4fbf-910a-c8d76fba27e2",
  user: {
    id: "6c0fe857-94f4-4ea4-a82b-688f11c9086f",
    email: "owner@example.test",
    displayName: "Owner Example",
  },
  activeOrganization: {
    id: "6c9df4d9-cda4-42de-8d6c-0890652d6307",
    name: "Example Club",
    role: "Owner",
  },
  capabilities: ["EditTariffs"],
};

function ProtectedPage() {
  return createElement("h1", null, "Protected workspace");
}

function authenticatedContext(
  capabilities = authenticatedSession.capabilities,
): SessionContextValue {
  return {
    status: "authenticated",
    ...authenticatedSession,
    capabilities,
    error: null,
    refresh: vi.fn(),
    signOut: vi.fn(),
  };
}

function SessionProbe() {
  const session = useSession();
  return createElement(
    "p",
    null,
    session.status === "authenticated"
      ? `${session.user!.displayName} · ${session.activeOrganization!.name} · ${session.membershipId}`
      : session.status,
  );
}

function ActorProbe() {
  const actor = usePortalActor();
  return createElement("p", null, actor?.memberId ?? "missing");
}

afterEach(() => {
  cleanup();
  replace.mockReset();
  vi.restoreAllMocks();
});

describe("session transport", () => {
  it("fetches only a relative API URL with same-origin cookie credentials", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await sessionFetch("/api/auth/sign-out", { method: "POST" });

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
    });
  });

  it("hydrates the provider from the server-issued session", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(authenticatedSession), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(createElement(SessionProvider, null, createElement(SessionProbe)));

    expect(
      await screen.findByText(
        "Owner Example · Example Club · a970f29a-b57f-4fbf-910a-c8d76fba27e2",
      ),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  });

  it("rejects a session with an unknown organization role", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...authenticatedSession,
          activeOrganization: {
            ...authenticatedSession.activeOrganization,
            role: "SuperAdmin",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(createElement(SessionProvider, null, createElement(SessionProbe)));

    expect(await screen.findByText("error")).toBeInTheDocument();
  });
});

describe("return targets", () => {
  it.each([
    "/\\evil.example",
    "/projects\\..\\sign-in",
    "/\u0000evil",
    "//evil.example",
  ])("rejects the adversarial return target %s", (target) => {
    expect(safeReturnTo(target)).toBe("/");
  });

  it("preserves a local path with query and fragment", () => {
    expect(safeReturnTo("/projects?status=planning#current")).toBe(
      "/projects?status=planning#current",
    );
  });
});

describe("protected routes", () => {
  it.each([
    "/",
    "/projects",
    "/settings",
    "/evaluate",
    "/evaluate/result",
    "/scout",
  ])(
    "redirects an unauthenticated user from %s to sign-in with a relative return path",
    async (pathname) => {
      render(
        createElement(
          RequireSession,
          { pathname },
          createElement(ProtectedPage),
        ),
      );

      const expectedHref = `/sign-in?returnTo=${encodeURIComponent(pathname)}`;
      expect(
        await screen.findByRole("link", { name: /sign in/i }),
      ).toHaveAttribute("href", expectedHref);
      await waitFor(() => expect(replace).toHaveBeenCalledWith(expectedHref));
      expect(
        screen.queryByRole("heading", { name: "Protected workspace" }),
      ).not.toBeInTheDocument();
    },
  );

  it("renders a protected page for an authenticated session", () => {
    render(
      createElement(
        SessionContext.Provider,
        { value: authenticatedContext() },
        createElement(
          RequireSession,
          { pathname: "/projects" },
          createElement(ProtectedPage),
        ),
      ),
    );

    expect(
      screen.getByRole("heading", { name: "Protected workspace" }),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("capability-aware controls", () => {
  it("hides tariff editing when the session lacks EditTariffs", () => {
    render(createElement(TariffActions, { capabilities: [] }));

    expect(
      screen.queryByRole("button", { name: /save tariffs/i }),
    ).not.toBeInTheDocument();
  });

  it("shows tariff editing when the server grants EditTariffs", () => {
    render(
      createElement(TariffActions, { capabilities: ["EditTariffs"] }),
    );

    expect(
      screen.getByRole("button", { name: /save tariffs/i }),
    ).toBeInTheDocument();
  });
});

describe("portal actor", () => {
  it("passes the server-issued membership id through the app shell", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      createElement(
        SessionContext.Provider,
        { value: authenticatedContext() },
        createElement(
          AppShell,
          { projects: [] },
          createElement(ActorProbe),
        ),
      ),
    );

    expect(
      screen.getByText("a970f29a-b57f-4fbf-910a-c8d76fba27e2"),
    ).toBeInTheDocument();
  });
});
