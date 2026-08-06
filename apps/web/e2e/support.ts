import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Fgp-Demo-2026!Pass";

export const FIVE_ROLES = [
  { role: "Owner", email: "owner@fgp.demo", editTariffs: true, manageTeam: true },
  {
    role: "Chairperson",
    email: "chairperson@fgp.demo",
    editTariffs: true,
    manageTeam: true,
  },
  {
    role: "Treasurer",
    email: "treasurer@fgp.demo",
    editTariffs: false,
    manageTeam: false,
  },
  {
    role: "Analyst",
    email: "analyst@fgp.demo",
    editTariffs: false,
    manageTeam: false,
  },
  {
    role: "Viewer",
    email: "viewer@fgp.demo",
    editTariffs: false,
    manageTeam: false,
  },
] as const;

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/^\//);
  await expect(page.locator(".portal-page, .auth-card").first()).toBeVisible();
}

export async function signOut(page: Page) {
  await page.goto("/sign-in");
  await page.waitForLoadState("domcontentloaded");
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
  return response.status();
}
