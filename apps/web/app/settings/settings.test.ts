import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";
import {
  SessionContext,
  type SessionContextValue,
} from "../../lib/session-context";
import { DEFAULT_PORTAL_SETTINGS } from "../../lib/portal-settings";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: vi.fn() }),
}));

const membership = {
  id: "a970f29a-b57f-4fbf-910a-c8d76fba27e2",
  userId: "6c0fe857-94f4-4ea4-a82b-688f11c9086f",
  email: "chair@example.test",
  displayName: "Chair Example",
  role: "Chairperson",
  status: "Active",
};

function sessionValue(capabilities: string[]): SessionContextValue {
  return {
    status: "authenticated",
    membershipId: "89c1371e-f5fd-4b31-817e-bbe8134e326e",
    user: {
      id: "c45881f1-9d3f-402f-8702-628affcf1ced",
      email: "owner@example.test",
      displayName: "Owner Example",
    },
    activeOrganization: {
      id: "d256b7a2-56af-4746-a1f2-66ecb1b00c96",
      name: "Example Club",
      role: "Owner",
    },
    capabilities,
    error: null,
    refresh: vi.fn(),
    signOut: vi.fn(),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installApi(
  members: Array<typeof membership> = [],
): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.pathname
            : new URL(input.url).pathname;
      if (path === "/api/settings") return jsonResponse(DEFAULT_PORTAL_SETTINGS);
      if (path === "/api/scrape/jobs") return jsonResponse([]);
      if (path === "/api/organizations/members") {
        if (init?.method === "PATCH") {
          return jsonResponse(membership);
        }
        return jsonResponse(members);
      }
      if (path === "/api/organizations/invitations") {
        return jsonResponse(
          {
            id: "bc5f26a3-8088-4d88-babf-fc63ea3260d7",
            email: "viewer@example.test",
            role: "Viewer",
            expiresAt: "2026-08-01T08:00:00Z",
          },
          201,
        );
      }
      if (path.startsWith("/api/organizations/members/")) {
        return jsonResponse(membership);
      }
      return jsonResponse({ message: `Unexpected request: ${path}` }, 404);
    },
  );
}

function renderSettings(capabilities: string[]) {
  return render(
    createElement(
      SessionContext.Provider,
      { value: sessionValue(capabilities) },
      createElement(SettingsPage),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("settings capabilities", () => {
  it("renders read-only state instead of mutation controls without ManageTeam", async () => {
    installApi();
    renderSettings([]);

    await screen.findByRole("heading", { name: "Settings" });
    expect(
      screen.queryByRole("button", { name: "Save settings" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Auto-score new leads" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Email alerts" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Property24 scraper" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Invite member" }),
    ).not.toBeInTheDocument();
  });
});

describe("organization membership transport", () => {
  it("uses Task 3 organization endpoints and adapts member DTOs", async () => {
    const fetchSpy = installApi([membership]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings(["ManageTeam"]);

    expect(await screen.findByText("Chair Example")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("/api/organizations/members");

    fireEvent.change(screen.getByRole("textbox", { name: "Member email" }), {
      target: { value: "viewer@example.test" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Invite member" }).closest("form")!,
    );
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/organizations/invitations",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "viewer@example.test",
            role: "Viewer",
          }),
        }),
      ),
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Role for Chair Example" }),
      { target: { value: "Viewer" } },
    );
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/organizations/members/${membership.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "Viewer" }),
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/organizations/members/${membership.id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "Removed" }),
        }),
      ),
    );
  });
});
