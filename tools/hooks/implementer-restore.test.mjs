// The implementer's steps for a task branch a stopped session left in another worktree (after-sprint fix 2),
// run for real on a scratch repository: its uncommitted, untracked and unpushed work all reach the new branch,
// the stash stays as a backup, and bash-guard --unattended lets every step run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHook, decision, sh } from "./test-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const STEPS = readFileSync(path.join(ROOT, ".claude", "agents", "implementer.md"), "utf8");
const MESSAGE = "task/5 left by a stopped session";
const git = (cwd, ...args) => sh("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], cwd);

test("the implementer's steps name the commands this test runs", () => {
  for (const step of [
    "git worktree list --porcelain",
    "git -C <that path> status --porcelain",
    'git -C <that path> stash push --include-untracked -m "task/<n> left by a stopped session"',
    "git switch -c task/<n>-2 task/<n>",
    "git merge origin/task/<n>",
    "git stash apply stash@{<k>}",
  ]) {
    assert.ok(STEPS.includes(step), `implementer.md no longer says ${step}`);
  }
});

test("a stopped session's uncommitted, untracked and unpushed work all reach task/<n>-2", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "td-restore-"));
  const origin = path.join(tmp, "origin.git");
  const main = path.join(tmp, "main");
  const left = path.join(tmp, "left");
  const mine = path.join(tmp, "mine");
  sh("git", ["init", "-q", "--bare", "-b", "main", origin], tmp);
  sh("git", ["clone", "-q", origin, main], tmp);
  writeFileSync(path.join(main, "a.txt"), "one\n");
  git(main, "add", ".");
  git(main, "commit", "-qm", "start");
  git(main, "push", "-q", "origin", "HEAD:main");

  // The stopped session: it pushed one commit, made another it never pushed, then edited and added files.
  git(main, "worktree", "add", "-q", "-b", "task/5", left, "origin/main");
  writeFileSync(path.join(left, "a.txt"), "pushed\n");
  git(left, "commit", "-qam", "pushed");
  git(left, "push", "-q", "origin", "task/5");
  writeFileSync(path.join(left, "b.txt"), "committed, never pushed\n");
  git(left, "add", "b.txt");
  git(left, "commit", "-qm", "unpushed");
  writeFileSync(path.join(left, "a.txt"), "uncommitted\n");
  writeFileSync(path.join(left, "c.txt"), "untracked\n");

  // The new implementer, in its own worktree, following the steps.
  git(main, "worktree", "add", "-q", "--detach", mine, "origin/main");
  const run = (...args) => {
    const command = ["git", ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(" ");
    const r = runHook("bash-guard.mjs", { tool_name: "Bash", tool_input: { command }, cwd: mine }, { args: ["--unattended"] });
    assert.equal(decision(r), "none", `bash-guard refused: ${command}`);
    return git(mine, ...args);
  };
  const list = run("worktree", "list", "--porcelain");
  const block = list.split(/\n\n/).find((b) => b.includes("branch refs/heads/task/5"));
  const found = block.match(/^worktree (.+)$/m)[1];
  assert.notEqual(run("-C", found, "status", "--porcelain"), "");
  run("-C", found, "stash", "push", "--include-untracked", "-m", MESSAGE);
  run("switch", "-q", "-c", "task/5-2", "task/5");
  run("merge", "-q", "origin/task/5");
  const k = run("stash", "list").split("\n").findIndex((l) => l.endsWith(MESSAGE));
  assert.equal(k, 0);
  run("stash", "apply", "-q", `stash@{${k}}`);

  assert.equal(readFileSync(path.join(mine, "a.txt"), "utf8").replace(/\r/g, ""), "uncommitted\n");
  assert.equal(readFileSync(path.join(mine, "b.txt"), "utf8").replace(/\r/g, ""), "committed, never pushed\n");
  assert.ok(existsSync(path.join(mine, "c.txt")), "the untracked file was lost");
  assert.match(git(mine, "stash", "list"), /task\/5 left by a stopped session/, "the backup stash is gone");
});
