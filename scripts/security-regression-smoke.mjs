import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [authRole, apiWorkflow, migrationReplay] = await Promise.all([
  readFile(new URL("./auth-role-smoke.mjs", import.meta.url), "utf8"),
  readFile(new URL("./api-workflow-smoke.mjs", import.meta.url), "utf8"),
  readFile(
    new URL("./capital-governance-migration-replay.sh", import.meta.url),
    "utf8",
  ),
]);

for (const [name, source] of [
  ["auth-role smoke", authRole],
  ["API workflow smoke", apiWorkflow],
]) {
  assert.doesNotMatch(
    source,
    /const password\s*=\s*["'`][^$]/,
    `${name} must not contain a literal password`,
  );
  assert.match(
    source,
    /randomBytes/,
    `${name} must generate a unique runtime password`,
  );
}

assert.doesNotMatch(
  migrationReplay,
  /POSTGRES_PASSWORD=[A-Za-z0-9_-]+/,
  "migration replay must not contain a literal database password",
);
assert.match(
  migrationReplay,
  /FGP_MIGRATION_TEST_DB_PASSWORD/,
  "migration replay must allow an explicit test password override",
);
assert.match(
  migrationReplay,
  /randomBytes/,
  "migration replay must generate its default database password at runtime",
);

console.log("Security regression smoke passed: test credentials are runtime-owned.");
