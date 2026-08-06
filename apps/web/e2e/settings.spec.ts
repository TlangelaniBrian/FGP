import { expect, test } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

for (const { role, email, manageTeam } of FIVE_ROLES) {
  test(`${role} sees Settings controls per the ManageTeam capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();

    const saveButton = page.getByRole("button", { name: "Save settings" });
    const autoScore = page.getByRole("button", {
      name: "Auto-score new leads",
    });

    if (manageTeam) {
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();
      await expect(autoScore).toHaveAttribute("aria-pressed", "true");

      await autoScore.click();
      await saveButton.click();
      await expect(page.getByRole("status")).toContainText(
        "Settings saved in the workspace database.",
      );

      await page.reload();
      await expect(
        page.getByRole("button", { name: "Auto-score new leads" }),
      ).toHaveAttribute("aria-pressed", "false");

      await page.getByRole("button", { name: "Auto-score new leads" }).click();
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByRole("status")).toContainText(
        "Settings saved in the workspace database.",
      );
    } else {
      await expect(saveButton).toHaveCount(0);
      await expect(autoScore).toHaveCount(0);
      expect(
        await apiStatus(page, "PUT", "/api/settings", { autoAnalyze: false }),
      ).toBe(403);
    }
  });
}
