import { expect, test } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

for (const { role, email, recordContribution } of FIVE_ROLES) {
  test(`${role} sees Scraper controls per the RecordContribution capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    await page.goto("/settings/scraper");
    await expect(
      page.getByRole("heading", { name: "Scraper jobs" }),
    ).toBeVisible();

    const queueButton = page.getByRole("button", {
      name: "Queue scraper job",
    });
    if (recordContribution) {
      await expect(
        page.getByRole("heading", { name: "Find new Gauteng listings" }),
      ).toBeVisible();
      await expect(queueButton).toBeVisible();
      expect(
        (
          await apiStatus(page, "POST", "/api/scrape/jobs", {
            source: "property24",
            location: "Midrand",
          })
        ).status,
      ).toBe(201);
    } else {
      await expect(queueButton).toHaveCount(0);
      await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
      expect(
        (
          await apiStatus(page, "POST", "/api/scrape/jobs", {
            source: "property24",
            location: "Midrand",
          })
        ).status,
      ).toBe(403);
    }
  });
}
