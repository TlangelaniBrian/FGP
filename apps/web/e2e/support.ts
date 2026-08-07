import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Fgp-Demo-2026!Pass"; // ggignore: deterministic demo-only credential

// This matrix asserts the current server-side CapabilityPolicy
// (apps/api/src/FGP.Api/Identity/AuthorizationPolicies.cs), not a UI convenience
// layer. The boolean fields mirror Capabilities.All; the policy is the truth source
// for every page assertion. It intentionally differs from the earlier design handoff
// for Treasurer (editTariffs/manageTeam) and Chairperson (propose goal/correction);
// reconciling the handoff with the policy is an owner decision tracked separately.
export const FIVE_ROLES = [
  {
    role: "Owner",
    email: "owner@fgp.demo",
    editTariffs: true,
    manageTeam: true,
    recordContribution: true,
    proposeFundGoal: true,
    proposeCorrection: true,
    coSignOperational: true,
    coSignFinancial: true,
  },
  {
    role: "Chairperson",
    email: "chairperson@fgp.demo",
    editTariffs: true,
    manageTeam: true,
    recordContribution: true,
    proposeFundGoal: true,
    proposeCorrection: true,
    coSignOperational: true,
    coSignFinancial: true,
  },
  {
    role: "Treasurer",
    email: "treasurer@fgp.demo",
    editTariffs: false,
    manageTeam: false,
    recordContribution: true,
    proposeFundGoal: true,
    proposeCorrection: true,
    coSignOperational: true,
    coSignFinancial: false,
  },
  {
    role: "Analyst",
    email: "analyst@fgp.demo",
    editTariffs: false,
    manageTeam: false,
    recordContribution: true,
    proposeFundGoal: false,
    proposeCorrection: false,
    coSignOperational: true,
    coSignFinancial: false,
  },
  {
    role: "Viewer",
    email: "viewer@fgp.demo",
    editTariffs: false,
    manageTeam: false,
    recordContribution: false,
    proposeFundGoal: false,
    proposeCorrection: false,
    coSignOperational: false,
    coSignFinancial: false,
  },
] as const;

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  await expect(page.locator(".portal-page").first()).toBeVisible();
}

export async function apiStatus(
  page: Page,
  method: string,
  url: string,
  body?: unknown,
) {
  const response = await page.request.fetch(url, {
    method,
    data: body,
  });
  return { status: response.status(), body: await response.text() };
}
