import { expect, test } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

let unlinkedListingId: number;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, FIVE_ROLES[0].email, DEMO_PASSWORD);
  const response = await page.request.post("/api/listings", {
    data: {
      address: `E2E unlinked parcel ${Date.now()}`,
      municipality: "tshwane",
      sizeSqm: 1000,
      price: 1000000,
    },
  });
  expect(response.ok()).toBeTruthy();
  const row = (await response.json()) as { id: number };
  unlinkedListingId = row.id;
  await context.close();
});

for (const { role, email, recordContribution } of FIVE_ROLES) {
  test(`${role} sees parcel-link controls per the RecordContribution capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    await page.goto(`/scout/${unlinkedListingId}`);
    // The unlinked section renders for every role; only the form itself is
    // capability-gated. Asserting the heading proves we reached the LinkParcelForm
    // branch, so the button assertion below is not vacuous.
    await expect(
      page.getByRole("heading", { name: "Attach the real parcel" }),
    ).toBeVisible();

    const linkButton = page.getByRole("button", { name: "Link to parcel" });

    if (recordContribution) {
      await expect(linkButton).toBeVisible();
    } else {
      await expect(linkButton).toHaveCount(0);
      expect(
        (
          await apiStatus(page, "POST", `/api/listings/${unlinkedListingId}/link-parcel`, {
            lat: -25.54,
            lng: 28.085,
          })
        ).status,
      ).toBe(403);
    }
  });
}
