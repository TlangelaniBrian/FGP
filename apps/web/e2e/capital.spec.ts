import { expect, test } from "@playwright/test";
import { apiStatus, DEMO_PASSWORD, FIVE_ROLES, signIn } from "./support";

for (const {
  role,
  email,
  recordContribution,
  proposeFundGoal,
  proposeCorrection,
  coSignOperational,
  coSignFinancial,
} of FIVE_ROLES) {
  test(`${role} sees Capital fund controls per the CapabilityPolicy`, async ({
    page,
  }) => {
    await signIn(page, email, DEMO_PASSWORD);
    await page.goto("/capital");
    await expect(
      page.getByRole("heading", { name: "Capital fund" }),
    ).toBeVisible();

    const recordButton = page.getByRole("button", {
      name: /Record contribution/,
    });
    const goalProposal = page.getByLabel("New fund goal");
    const correctButton = page.getByRole("button", {
      name: "Correct",
      exact: true,
    });

    if (recordContribution) {
      await expect(recordButton).toBeVisible();
    } else {
      await expect(recordButton).toHaveCount(0);
    }

    if (proposeFundGoal) {
      await expect(goalProposal).toBeVisible();
    } else {
      await expect(goalProposal).toHaveCount(0);
    }

    if (proposeCorrection) {
      await expect(correctButton.first()).toBeVisible();
    } else {
      await expect(correctButton).toHaveCount(0);
    }

    const denied: Array<[string, Record<string, unknown>]> = [];
    if (!recordContribution) {
      denied.push([
        "record a contribution",
        { action: "contribution", amount: 1000 },
      ]);
    }
    if (!proposeFundGoal) {
      denied.push(["propose a goal", { action: "goal", newAmount: 800000 }]);
    }
    if (!proposeCorrection) {
      denied.push([
        "propose a correction",
        {
          action: "correction",
          contributionId: 1,
          correctionAction: "edit",
          amount: 5000,
        },
      ]);
    }
    if (!coSignOperational) {
      denied.push([
        "co-sign a goal",
        { action: "approve-goal", proposalId: 1 },
      ]);
    }
    if (!coSignFinancial) {
      denied.push([
        "co-sign a correction",
        { action: "approve-correction", proposalId: 1 },
      ]);
    }

    for (const [label, body] of denied) {
      const response = await apiStatus(page, "POST", "/api/capital", body);
      expect(
        response.status,
        `${role} must not be able to ${label}`,
      ).toBe(403);
    }
  });
}
