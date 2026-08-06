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
import TariffsPage from "./page";
import {
  SessionContext,
  type SessionContextValue,
} from "../../../lib/session-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/tariffs",
  useRouter: () => ({ replace: vi.fn() }),
}));

const SEEDED_TARIFFS = {
  year: 2026,
  tariffs: {
    build_rates: { bachelor: 13500, "1bed": 14200, "2bed": 15000, luxury: 18500 },
    unit_sizes: { bachelor: 35, "1bed": 55, "2bed": 85, luxury: 120 },
    market_rents: { bachelor: 4500, "1bed": 6500, "2bed": 9500, luxury: 18000 },
    bulk_contributions: {
      johannesburg: { bachelor: [45000, 65000], "1bed": [55000, 75000], "2bed": [65000, 85000], luxury: [80000, 100000] },
      tshwane: { bachelor: [38000, 55000], "1bed": [45000, 65000], "2bed": [55000, 75000], luxury: [70000, 90000] },
      ekurhuleni: { bachelor: [40000, 58000], "1bed": [48000, 68000], "2bed": [58000, 78000], luxury: [75000, 95000] },
    },
    transfer_duty_brackets: [
      [1100000, 0, 0],
      [1512500, 0.03, 0],
      [2117500, 0.06, 12375],
      [2722500, 0.08, 49125],
      [12100000, 0.11, 97125],
      [null, 0.13, 1128600],
    ],
    fees: { professional_fee_pct: 0.12 },
  },
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

function installApi() {
  const putBodies: unknown[] = [];
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: string | URL | Request, init?: RequestInit) => {
      const path =
        typeof input === "string"
          ? input.split("?")[0]
          : input instanceof URL
            ? input.pathname
            : new URL(input.url).pathname;
      if (path === "/api/tariffs") {
        if (init?.method === "PUT") {
          putBodies.push(JSON.parse(String(init.body)));
          return jsonResponse({ ok: true });
        }
        return jsonResponse(SEEDED_TARIFFS);
      }
      return jsonResponse({ message: `Unexpected request: ${path}` }, 404);
    },
  );
  return { fetchMock, putBodies };
}

function renderTariffs(capabilities: string[]) {
  return render(
    createElement(
      SessionContext.Provider,
      { value: sessionValue(capabilities) },
      createElement(TariffsPage),
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("tariffs page capabilities", () => {
  it("loads seeded values into structured fields for an editor", async () => {
    installApi();
    renderTariffs(["EditTariffs"]);

    const bachelorRate = await screen.findByLabelText(
      "build rate Bachelor (studio)",
    );
    expect(bachelorRate).toHaveValue(13500);
    expect(bachelorRate).not.toBeDisabled();

    expect(screen.getByLabelText("bulk contribution johannesburg bachelor min")).toHaveValue(45000);
    expect(screen.getByLabelText("transfer duty bracket 1 upper")).toHaveValue(1100000);
    expect(screen.getByLabelText("transfer duty bracket 6 upper")).toHaveValue(null);
    expect(screen.getByLabelText("fees professional fee percent")).toHaveValue(0.12);

    expect(screen.getAllByRole("button", { name: /save tariffs/i })).toHaveLength(6);
  });

  it("shows the lock banner, disabled inputs, and no save buttons without EditTariffs", async () => {
    installApi();
    renderTariffs([]);

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/tariffs are locked/i);
    const bachelorRate = await screen.findByLabelText(
      "build rate Bachelor (studio)",
    );
    expect(bachelorRate).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save tariffs/i })).toBeNull();
  });

  it("sends the exact category JSON contract on save and confirms success", async () => {
    const { putBodies } = installApi();
    renderTariffs(["EditTariffs"]);

    const bachelorRate = await screen.findByLabelText(
      "build rate Bachelor (studio)",
    );
    fireEvent.change(bachelorRate, { target: { value: "13800" } });

    const saveButtons = screen.getAllByRole("button", { name: /save tariffs/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(putBodies).toContainEqual({
        year: 2026,
        category: "build_rates",
        data: { bachelor: 13800, "1bed": 14200, "2bed": 15000, luxury: 18500 },
      });
    });
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it("rejects invalid values before calling the API", async () => {
    const { putBodies } = installApi();
    renderTariffs(["EditTariffs"]);

    const bachelorRate = await screen.findByLabelText(
      "build rate Bachelor (studio)",
    );
    fireEvent.change(bachelorRate, { target: { value: "0" } });

    const saveButtons = screen.getAllByRole("button", { name: /save tariffs/i });
    fireEvent.click(saveButtons[0]);

    expect(
      await screen.findByText(/invalid values — fix and retry/i),
    ).toBeInTheDocument();
    expect(putBodies).toHaveLength(0);
  });

  it("blocks re-saving while a category is saving", async () => {
    installApi();
    renderTariffs(["EditTariffs"]);

    const saveButtons = await screen.findAllByRole("button", {
      name: /save tariffs/i,
    });
    fireEvent.click(saveButtons[0]);
    expect(saveButtons[0]).toBeDisabled();
  });
});
