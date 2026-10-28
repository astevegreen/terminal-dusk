import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runHook, denied, tempRepo, sh } from "./test-helpers.mjs";

const repo = tempRepo({ "CLAUDE.md": "x\n" });
const edit = (file, cwd = repo, tool_name = "Edit") =>
  runHook("file-lock.mjs", { cwd, tool_name, tool_input: { file_path: path.join(cwd, file) } });

// The guards, hooks and gates that govern a lane's or night run's own session (owner's policy, 28 Oct 2026, P6).
for (const file of [".claude/settings.json", ".claude/agents/implementer.md", ".claude/skills/sprint-lane/SKILL.md",
  "tools/hooks/gate.mjs", "tools/gates/gate.mjs", "tools/git-hooks/pre-commit"]) {
  test(`refuses edits to Locked file ${file}`, () => {
    const r = edit(file);
    assert.ok(denied(r), r.stdout);
    assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /Locked/);
  });
}

test("refuses Write as well as Edit", () => {
  assert.ok(denied(edit(".claude/settings.json", repo, "Write")));
});

// A workflow runs with the repository's secrets as soon as its branch is pushed, before the rail audit, and the
// implementer only runs unattended: a lane that needs one changed is blocked for a day session.
for (const file of [".github/workflows/ci.yml", ".github/workflows/new-job.yml"]) {
  test(`refuses edits to the CI workflow ${file}, for a day session`, () => {
    const r = edit(file, repo, "Write");
    assert.ok(denied(r), r.stdout);
    const why = r.json.hookSpecificOutput.permissionDecisionReason;
    assert.match(why, /Locked file \(\.github\/workflows\/\)/);
    assert.match(why, /secrets/);
    assert.match(why, /Blocked: needs a day session/);
  });
}

// P6: instructions and docs no longer wait for the owner; CI, the reviewer and agy's rail audit check them.
for (const file of ["packages/engine/src/apply.ts", "docs/design/coups.md", "tools/repo-map.mjs", "docs/architecture-notes.md",
  "CLAUDE.md", "GEMINI.md", "docs/architecture.md", ".github/ISSUE_TEMPLATE/task.yml"]) {
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
  assert.ok(denied(edit(".claude/settings.json", wt)));
  assert.ok(denied(edit("tools/hooks/file-lock.mjs", wt)));
});

if (process.platform === "win32") {
  test("matching ignores case on Windows", () => {
    assert.ok(denied(edit("TOOLS/Hooks/gate.mjs")));
    assert.ok(denied(edit(".CLAUDE/settings.json")));
  });
}
