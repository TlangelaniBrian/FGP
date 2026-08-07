/**
 * Capital fund milestones are quarter-steps of the organisation's current goal.
 * They are derived rather than stored, so they move whenever a contribution is
 * posted or the goal is re-set by unanimous co-sign.
 */
export const MILESTONE_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

export type CapitalMilestone = {
  /** Balance this milestone is reached at. */
  amount: number;
  /** Still to raise before the milestone is reached. Always positive. */
  remaining: number;
  /** Human label, e.g. "50% of goal". */
  label: string;
};

/**
 * The lowest milestone the fund has not yet reached, or `null` once the balance
 * covers the goal (or when no positive goal is set).
 */
export function nextCapitalMilestone(
  total: number,
  goal: number,
): CapitalMilestone | null {
  if (!Number.isFinite(goal) || goal <= 0) return null;
  if (!Number.isFinite(total)) return null;

  const milestone = MILESTONE_FRACTIONS.map((fraction) => ({
    fraction,
    amount: goal * fraction,
  })).find((candidate) => candidate.amount > total);

  if (!milestone) return null;

  return {
    amount: milestone.amount,
    remaining: milestone.amount - total,
    label: `${Math.round(milestone.fraction * 100)}% of goal`,
  };
}
