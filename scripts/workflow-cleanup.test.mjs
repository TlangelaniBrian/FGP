import assert from "node:assert/strict";
import test from "node:test";
import { attemptAll, createRunIdentity } from "./workflow-cleanup.mjs";

test("createRunIdentity never reuses a caller-supplied diagnostic prefix", () => {
  const first = createRunIdentity(" Existing@Test Identity ");
  const second = createRunIdentity(" Existing@Test Identity ");

  assert.equal(first.diagnosticPrefix, "existing-test");
  assert.equal(second.diagnosticPrefix, "existing-test");
  assert.notEqual(first.runId, second.runId);
  assert.notEqual(first.email, second.email);
  assert.notEqual(first.marker, second.marker);
  assert.notEqual(first.email, "Existing@Test Identity");
  assert.notEqual(first.email, "fgp-workflow-existing-test@example.com");
  assert.notEqual(second.email, "fgp-workflow-existing-test@example.com");
  assert.match(first.runId, /^existing-test-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("attemptAll runs every cleanup task before aggregating failures", async () => {
  const calls = [];

  await assert.rejects(
    attemptAll([
      ["records", async () => { calls.push("records"); throw new Error("record delete failed"); }],
      ["activity", async () => { calls.push("activity"); }],
      ["settings", async () => { calls.push("settings"); throw new Error("settings restore failed"); }],
      ["auth", async () => { calls.push("auth"); }],
    ]),
    (error) => {
      assert(error instanceof AggregateError);
      assert.equal(error.errors.length, 2);
      assert.match(error.errors[0].message, /^records: record delete failed$/);
      assert.match(error.errors[1].message, /^settings: settings restore failed$/);
      return true;
    },
  );

  assert.deepEqual(calls, ["records", "activity", "settings", "auth"]);
});
