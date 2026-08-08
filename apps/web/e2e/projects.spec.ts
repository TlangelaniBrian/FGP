import { expect, test, type Page } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

async function seededProject(page: Page): Promise<{ id: number; name: string }> {
  const response = await page.request.get("/api/projects");
  expect(response.ok()).toBeTruthy();
  const projects = (await response.json()) as Array<{ id: number; name: string }>;
  const project = projects[0];
  if (!project) throw new Error("No seeded project was found.");
  return project;
}

for (const { role, email, recordContribution } of FIVE_ROLES) {
  test(`${role} sees Project controls per the RecordContribution capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    const project = await seededProject(page);
    await page.goto(`/projects/${project.id}`);
    await expect(
      page.getByRole("heading", { name: project.name }),
    ).toBeVisible();

    const editButton = page.getByRole("button", { name: "Edit project" });
    const logCheckIn = page.getByRole("button", { name: "Log check-in" });
    const addDetail = page.getByRole("heading", {
      name: "Add a live detail",
    });

    if (recordContribution) {
      await expect(editButton).toBeVisible();
      await expect(logCheckIn).toBeVisible();
      await expect(addDetail).toBeVisible();
    } else {
      await expect(editButton).toHaveCount(0);
      await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
      await expect(logCheckIn).toHaveCount(0);
      await expect(addDetail).toHaveCount(0);
      expect(
        (
          await apiStatus(page, "PATCH", `/api/projects/${project.id}`, {
            name: project.name,
            status: "planning",
            notes: null,
          })
        ).status,
      ).toBe(403);
    }
  });
}
