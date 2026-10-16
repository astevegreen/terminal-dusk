import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runHook, denied, tempRepo, sh } from "./test-helpers.mjs";

const repo = tempRepo({ "CLAUDE.md": "x\n" });
const edit = (file, cwd = repo, tool_name = "Edit") =>
  runHook("file-lock.mjs", { cwd, tool_name, tool_input: { file_path: path.join(cwd, file) } });

for (const file of ["CLAUDE.md", "GEMINI.md", ".claude/settings.json", ".claude/agents/implementer.md", ".github/workflows/ci.yml",
  "docs/architecture.md", "tools/hooks/gate.mjs", "tools/gates/gate.mjs"]) {
  test(`refuses edits to Locked file ${file}`, () => {
    const r = edit(file);
    assert.ok(denied(r), r.stdout);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /Locked/);
  });
}

test("refuses Write as well as Edit", () => {
  assert.ok(denied(edit("CLAUDE.md", repo, "Write")));
});

for (const file of ["packages/engine/src/apply.ts", "docs/design/coups.md", "tools/repo-map.mjs", "docs/architecture-notes.md"]) {
  test(`allows edits to ${file}`, () => {
    const r = edit(file);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  });
}

test("inside a worktree under .claude/worktrees, paths are judged from the worktree root", () => {
  const wt = path.join(repo, ".claude", "worktrees", "task-1");
  sh("git", ["worktree", "add", "-q", "-b", "task/1", wt], repo);
  assert.equal(edit("packages/engine/src/apply.ts", wt).stdout, "");
  assert.ok(denied(edit("CLAUDE.md", wt)));
  assert.ok(denied(edit("tools/hooks/file-lock.mjs", wt)));
});

if (process.platform === "win32") {
  test("matching ignores case on Windows", () => {
    assert.ok(denied(edit("claude.md")));
    assert.ok(denied(edit(".CLAUDE/settings.json")));
  });
}
