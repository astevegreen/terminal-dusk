// Tests for no-plugin-writes.mjs: the sprint's sessions read GitHub through the plugin but never write with it,
// and every unattended sprint skill wires the hook in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runHook, denied, decision } from "./test-helpers.mjs";

const plugin = (verb) => ({ tool_name: `mcp__plugin_github_github__${verb}`, tool_input: { body: "x" } });

test("refuses the plugin's write tools, naming gh instead", () => {
  for (const verb of [
    "add_issue_comment",
    "update_issue_comment",
    "issue_write",
    "create_pull_request",
    "update_pull_request",
    "merge_pull_request",
    "pull_request_review_write",
    "push_files",
    "create_or_update_file",
    "mark_all_notifications_read",
  ]) {
    const r = runHook("no-plugin-writes.mjs", plugin(verb));
    assert.equal(r.status, 0);
    assert.ok(denied(r), `${verb} was not refused`);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /writes to GitHub as the owner.*gh issue comment/);
  }
});

test("refuses a write tool the plugin adds later, since only read names pass", () => {
  assert.ok(denied(runHook("no-plugin-writes.mjs", plugin("lock_issue"))));
});

test("lets the plugin's reads through", () => {
  for (const verb of ["get_me", "list_issues", "search_issues", "issue_read", "pull_request_read", "get_file_contents"]) {
    assert.equal(decision(runHook("no-plugin-writes.mjs", plugin(verb))), "none", `${verb} was refused`);
  }
});

test("refuses when the input is empty or malformed", () => {
  assert.ok(denied(runHook("no-plugin-writes.mjs", {})));
});

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const UNATTENDED = ["sprint-supervisor", "sprint-lane", "sprint-plan", "sprint-start", "sprint-stop", "night-shift"];

test("every unattended sprint skill runs it on the plugin's tools", () => {
  for (const skill of UNATTENDED) {
    const text = readFileSync(path.join(ROOT, ".claude", "skills", skill, "SKILL.md"), "utf8");
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    assert.match(
      front,
      /- matcher: "mcp__plugin_github_\.\*"\s+hooks:\s+- type: command\s+command: node "\$CLAUDE_PROJECT_DIR\/tools\/hooks\/no-plugin-writes\.mjs"/,
      `${skill} doesn't wire no-plugin-writes.mjs`,
    );
  }
});
