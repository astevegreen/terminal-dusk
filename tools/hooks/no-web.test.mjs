import { test } from "node:test";
import assert from "node:assert/strict";
import { runHook, denied } from "./test-helpers.mjs";

test("blocks a web page fetch", () => {
  const r = runHook("no-web.mjs", { tool_name: "WebFetch", tool_input: { url: "https://example.com", prompt: "summarise" } });
  assert.equal(r.status, 0);
  assert.ok(denied(r), `expected deny, got ${r.stdout || "nothing"}`);
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /^Blocked by no-web: .*night shift/);
});

test("blocks even when the input is empty or malformed", () => {
  const r = runHook("no-web.mjs", {});
  assert.equal(r.status, 0);
  assert.ok(denied(r), `expected deny, got ${r.stdout || "nothing"}`);
});
