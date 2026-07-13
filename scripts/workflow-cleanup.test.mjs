import assert from "node:assert/strict";
import test from "node:test";
import { attemptAll } from "./workflow-cleanup.mjs";

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
