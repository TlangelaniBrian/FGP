import { expect, test, type Page } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

const SOSHANGUVE_SUBURB = "Soshanguve South Ext 13";

async function zoningListingId(page: Page): Promise<number> {
  const response = await page.request.get("/api/listings");
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as Array<{
    id: number;
    suburb: string | null;
  }>;
  const lead = rows.find((row) => row.suburb === SOSHANGUVE_SUBURB);
  if (!lead) throw new Error(`Seed lead ${SOSHANGUVE_SUBURB} was not found.`);
  return lead.id;
}

async function zoningCertificateId(page: Page, listingId: number): Promise<number> {
  const response = await page.request.get(`/api/documents?listingId=${listingId}`);
  expect(response.ok()).toBeTruthy();
  const documents = (await response.json()) as Array<{
    id: number;
    docType: string;
  }>;
  const document = documents.find(
    (item) => item.docType === "zoning_certificate",
  );
  if (!document) {
    throw new Error(`Seeded zoning_certificate for listing ${listingId} was not found.`);
  }
  return document.id;
}

for (const { role, email, recordContribution } of FIVE_ROLES) {
  test(`${role} sees Zoning controls per the RecordContribution capability`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    const listingId = await zoningListingId(page);
    await page.goto(`/scout/${listingId}/zoning`);
    await expect(
      page.getByRole("heading", { name: "Zoning and forms" }),
    ).toBeVisible();

    const statusSelect = page.getByLabel("Status for zoning_certificate");
    const generatePackage = page.getByRole("button", {
      name: "Generate package",
    });

    if (recordContribution) {
      await expect(statusSelect).toBeVisible();
      await expect(statusSelect).toBeEnabled();
      await expect(generatePackage).toBeVisible();
    } else {
      await expect(statusSelect).toHaveCount(0);
      await expect(generatePackage).toHaveCount(0);
      await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    }

    // Downloads stay open to every role; only status edits and generation require
    // RecordContribution.
    await expect(page.getByRole("link", { name: "PDF" })).toBeVisible();

    const documentId = await zoningCertificateId(page, listingId);
    const patch = await apiStatus(page, "PATCH", `/api/documents/${documentId}`, {
      status: "ready",
    });
    const generate = await apiStatus(
      page,
      "POST",
      `/api/documents/${documentId}/download`,
      {},
    );
    if (recordContribution) {
      expect(patch.status).toBe(200);
      expect(generate.status).toBe(200);
    } else {
      expect(patch.status).toBe(403);
      expect(generate.status).toBe(403);
      const create = await apiStatus(page, "POST", "/api/documents", {
        listingId,
        forms: ["zoning_certificate"],
      });
      expect(create.status).toBe(403);
    }
  });
}
