import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook } from "./test-helpers.mjs";

test("warns the owner when ANTHROPIC_API_KEY is set", () => {
  const r = runHook("env-check.mjs", { hook_event_name: "SessionStart", source: "startup" }, { env: { ANTHROPIC_API_KEY: "dummy" } });
  assert.equal(r.status, 0);
  assert.match(r.json?.systemMessage ?? "", /ANTHROPIC_API_KEY is set/);
});

test("only ever prints a systemMessage, never plain text for Claude's context", () => {
  const r = runHook("env-check.mjs", { hook_event_name: "SessionStart", source: "startup" }, { env: { ANTHROPIC_API_KEY: "" } });
  assert.equal(r.status, 0);
  if (r.stdout.trim()) assert.deepEqual(Object.keys(r.json ?? {}), ["systemMessage"]);
});
