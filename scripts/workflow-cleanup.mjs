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
