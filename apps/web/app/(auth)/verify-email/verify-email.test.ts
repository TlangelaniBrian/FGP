import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import VerifyEmailPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("resends verification through the account lifecycle endpoint", async () => {
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 204 }));

  render(createElement(VerifyEmailPage));

  fireEvent.change(
    await screen.findByRole("textbox", { name: "Verification email" }),
    {
      target: { value: "owner@example.test" },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Resend verification email" }),
  );

  await waitFor(() =>
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/verification-resend",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ email: "owner@example.test" }),
      }),
    ),
  );
  expect(
    await screen.findByText(
      "If the account is awaiting verification, a new email has been sent.",
    ),
  ).toBeInTheDocument();
});
