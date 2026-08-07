import { expect, test } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

for (const { role, email, editTariffs } of FIVE_ROLES) {
  test(`${role} sees Tariff controls per the EditTariffs capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    await page.goto("/settings/tariffs");
    await expect(
      page.getByRole("heading", { name: "Tariff administration" }),
    ).toBeVisible();

    const bachelorRate = page.getByLabel("build rate Bachelor (studio)");

    if (editTariffs) {
      await expect(bachelorRate).toBeEnabled();
      const original = await bachelorRate.inputValue();
      const updated = original === "13600" ? "13650" : "13600";
      await bachelorRate.fill(updated);
      await page
        .getByRole("button", { name: "Save tariffs" })
        .first()
        .click();
      await expect(page.getByText(/Saved/).first()).toBeVisible();

      await page.reload();
      await expect(
        page.getByLabel("build rate Bachelor (studio)"),
      ).toHaveValue(updated);

      await page.getByLabel("build rate Bachelor (studio)").fill(original);
      await page
        .getByRole("button", { name: "Save tariffs" })
        .first()
        .click();
      await expect(page.getByText(/Saved/).first()).toBeVisible();
    } else {
      await expect(page.getByRole("status")).toContainText(
        /tariffs are locked for/i,
      );
      await expect(bachelorRate).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Save tariffs" }),
      ).toHaveCount(0);
      expect(
        (
          await apiStatus(page, "PUT", "/api/tariffs", {
            year: 2026,
            category: "build_rates",
            data: {
              bachelor: 13500,
              "1bed": 14200,
              "2bed": 15000,
              luxury: 18500,
            },
          })
        ).status,
      ).toBe(403);
    }
  });
}
