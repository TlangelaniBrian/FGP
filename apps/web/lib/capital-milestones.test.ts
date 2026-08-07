import { describe, expect, it } from "vitest";
import { nextCapitalMilestone } from "./capital-milestones";

describe("nextCapitalMilestone", () => {
  it("returns the first quarter step above the current balance", () => {
    // The seeded demo state: R193 500 raised against a R760 000 goal.
    // 25% (R190 000) is already cleared, so 50% is next.
    const milestone = nextCapitalMilestone(193_500, 760_000);

    expect(milestone).toEqual({
      amount: 380_000,
      remaining: 186_500,
      label: "50% of goal",
    });
  });

  it("starts at the first quarter when nothing has been contributed", () => {
    expect(nextCapitalMilestone(0, 760_000)).toEqual({
      amount: 190_000,
      remaining: 190_000,
      label: "25% of goal",
    });
  });

  it("advances past a milestone that has been exactly reached", () => {
    // Landing exactly on 25% means 25% is done, not pending.
    const milestone = nextCapitalMilestone(190_000, 760_000);

    expect(milestone?.label).toBe("50% of goal");
    expect(milestone?.remaining).toBe(190_000);
  });

  it("treats the goal itself as the final milestone", () => {
    const milestone = nextCapitalMilestone(600_000, 760_000);

    expect(milestone).toEqual({
      amount: 760_000,
      remaining: 160_000,
      label: "100% of goal",
    });
  });

  it("returns null once the balance covers the goal", () => {
    expect(nextCapitalMilestone(760_000, 760_000)).toBeNull();
    expect(nextCapitalMilestone(900_000, 760_000)).toBeNull();
  });

  it("returns null when no positive goal is set", () => {
    expect(nextCapitalMilestone(50_000, 0)).toBeNull();
    expect(nextCapitalMilestone(50_000, -1)).toBeNull();
    expect(nextCapitalMilestone(50_000, Number.NaN)).toBeNull();
  });
});
