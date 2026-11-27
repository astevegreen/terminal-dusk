import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { sh, writeFiles } from "../hooks/test-helpers.mjs";
import { MAP, branchWith, commit, mapOf, repoWithHook, storedMode } from "./test-repo.mjs";

const FEATURE = { "feature.ts": "// Only on the branch.\n" };
const BROKEN = { "tools/repo-map.mjs": "process.exit(1);\n" };

test("a checkout leaves a fresh docs/repo-map.md and a clean working tree", () => {
  const repo = repoWithHook("post-checkout");
  branchWith(repo, "feature", FEATURE);

  sh("git", ["switch", "-q", "feature"], repo);
  assert.match(mapOf(repo), /`feature\.ts` - Only on the branch\./);
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");

  sh("git", ["switch", "-q", "main"], repo);
  assert.match(mapOf(repo), /`tools\/repo-map\.mjs`/);
  assert.doesNotMatch(mapOf(repo), /feature\.ts/);
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
});

test("`git worktree add` leaves a fresh docs/repo-map.md in the new worktree", () => {
  const repo = repoWithHook("post-checkout");
  branchWith(repo, "feature", FEATURE);
  const worktree = `${repo}-worktree`;
  sh("git", ["worktree", "add", "-q", worktree, "feature"], repo);

  assert.match(mapOf(worktree), /`feature\.ts` - Only on the branch\./);
  assert.equal(sh("git", ["status", "--porcelain"], worktree), "");
  // The new worktree's map was written there, not in the checkout the command ran in.
  assert.equal(existsSync(path.join(repo, MAP)), false);
});

test("a worktree that uses the main checkout's hooks folder still gets its own map", () => {
  const repo = repoWithHook("post-checkout");
  // Claude Code's worktrees point core.hooksPath at the main checkout, by its full path.
  sh("git", ["config", "core.hooksPath", path.join(repo, "tools/git-hooks")], repo);
  branchWith(repo, "feature", FEATURE);
  const worktree = `${repo}-worktree`;
  sh("git", ["worktree", "add", "-q", worktree, "feature"], repo);

  assert.match(mapOf(worktree), /`feature\.ts`/);
  assert.equal(existsSync(path.join(repo, MAP)), false);
});

test("a checkout and a `git worktree add` still succeed when the map script fails", () => {
  const repo = repoWithHook("post-checkout");
  commit(repo, "break the map script", BROKEN);
  const worktree = `${repo}-worktree`;
  // sh throws when git exits with an error, and git passes the hook's exit code on.
  sh("git", ["switch", "-q", "-c", "other"], repo);
  sh("git", ["worktree", "add", "-q", worktree, "main"], repo);
  assert.equal(existsSync(path.join(worktree, MAP)), false);
});

test("a checkout of a commit that still tracks the map leaves that file as committed", () => {
  const repo = repoWithHook("post-checkout", { ignored: [] });
  // Branches made before the map was untracked: rewriting it there would leave changes that block a later merge.
  branchWith(repo, "old", { [MAP]: "committed long ago\n" });
  writeFiles(repo, { ".git/info/exclude": `${MAP}\n` });
  sh("git", ["switch", "-q", "old"], repo);

  assert.equal(mapOf(repo), "committed long ago\n");
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
});

test("git stores post-checkout as executable", () => {
  assert.equal(storedMode("tools/git-hooks/post-checkout"), "100755");
});
