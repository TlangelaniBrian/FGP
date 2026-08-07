import { expect, test, type Page } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

const SOSHANGUVE_SUBURB = "Soshanguve South Ext 13";

async function seededListing(page: Page): Promise<{ id: number; address: string }> {
  const response = await page.request.get("/api/listings");
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as Array<{
    id: number;
    address: string | null;
    suburb: string | null;
  }>;
  const lead = rows.find((row) => row.suburb === SOSHANGUVE_SUBURB);
  if (!lead?.address) {
    throw new Error(`Seed lead ${SOSHANGUVE_SUBURB} was not found.`);
  }
  return { id: lead.id, address: lead.address };
}

async function createUnlinkedListing(page: Page): Promise<number> {
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
  return row.id;
}

for (const { role, email, recordContribution } of FIVE_ROLES) {
  test(`${role} sees parcel-link controls per the RecordContribution capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    const linkButton = page.getByRole("button", { name: "Link to parcel" });

    if (recordContribution) {
      const listingId = await createUnlinkedListing(page);
      await page.goto(`/scout/${listingId}`);
      await expect(
        page.getByRole("heading", { name: "Attach the real parcel" }),
      ).toBeVisible();
      await expect(linkButton).toBeVisible();
    } else {
      const listing = await seededListing(page);
      await page.goto(`/scout/${listing.id}`);
      await expect(
        page.getByRole("heading", { name: listing.address }),
      ).toBeVisible();
      await expect(linkButton).toHaveCount(0);
      expect(
        (
          await apiStatus(page, "POST", `/api/listings/${listing.id}/link-parcel`, {
            lat: -25.54,
            lng: 28.085,
          })
        ).status,
      ).toBe(403);
    }
  });
}
