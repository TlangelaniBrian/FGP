import { randomUUID } from "node:crypto";

export function createRunIdentity(prefix) {
  const diagnosticPrefix = String(prefix ?? "run")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 13)
    .replace(/-+$/g, "") || "run";
  const runId = `${diagnosticPrefix}-${randomUUID()}`;

  return {
    diagnosticPrefix,
    runId,
    marker: `fgp-workflow:${runId}`,
    email: `fgp-workflow-${runId}@example.com`,
    secondaryEmail: `fgp-workflow-secondary-${runId}@example.com`,
    actorName: `Workflow Smoke ${runId}`,
  };
}

export async function attemptAll(tasks) {
  const errors = [];

  for (const [label, task] of tasks) {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(new Error(`${label}: ${message}`, { cause: error }));
    }
  }

  if (errors.length) {
    throw new AggregateError(errors, `${errors.length} cleanup task${errors.length === 1 ? "" : "s"} failed`);
  }
}
