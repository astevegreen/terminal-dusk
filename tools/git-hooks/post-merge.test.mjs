import { test } from "node:test";
import assert from "node:assert/strict";
import { sh, writeFiles } from "../hooks/test-helpers.mjs";
import { MAP, branchWith, commit, mapOf, repoWithHook, storedMode } from "./test-repo.mjs";

const merge = (repo, ...args) => sh("git", ["merge", "-q", "--no-edit", ...args], repo);

test("a merge leaves a fresh docs/repo-map.md and a clean working tree, fast-forward or not", () => {
  const repo = repoWithHook("post-merge");
  branchWith(repo, "first", { "first.ts": "// Merged first.\n" });
  branchWith(repo, "second", { "second.ts": "// Merged second.\n" });

  merge(repo, "--ff-only", "first");
  assert.match(mapOf(repo), /`first\.ts` - Merged first\./);
  assert.doesNotMatch(mapOf(repo), /second\.ts/);

  merge(repo, "--no-ff", "second");
  assert.match(mapOf(repo), /`second\.ts` - Merged second\./);
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
});

test("merging the change that untracks the map writes it again, untracked", () => {
  const repo = repoWithHook("post-merge", { ignored: [] });
  commit(repo, "a tracked map", { [MAP]: "committed long ago\n" });
  sh("git", ["-c", "core.hooksPath=no-hooks", "switch", "-q", "-c", "untrack"], repo);
  sh("git", ["rm", "-q", "--cached", MAP], repo);
  commit(repo, "untrack the map", { ".gitignore": `${MAP}\n` });
  sh("git", ["-c", "core.hooksPath=no-hooks", "switch", "-q", "-f", "main"], repo);

  merge(repo, "untrack");
  assert.match(mapOf(repo), /^# Repository map\n/);
  assert.equal(sh("git", ["ls-files", MAP], repo), "");
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
});

test("a merge on a branch that still tracks the map leaves that file as committed", () => {
  const repo = repoWithHook("post-merge", { ignored: [] });
  commit(repo, "a tracked map", { [MAP]: "committed long ago\n" });
  branchWith(repo, "feature", { "feature.ts": "// A feature.\n" });
  merge(repo, "feature");

  assert.equal(mapOf(repo), "committed long ago\n");
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
});

test("a merge still succeeds when the map script fails", () => {
  const repo = repoWithHook("post-merge");
  branchWith(repo, "feature", { "feature.ts": "// A feature.\n" });
  writeFiles(repo, { "tools/repo-map.mjs": "process.exit(1);\n" });
  merge(repo, "feature");
  assert.equal(sh("git", ["log", "-1", "--format=%s"], repo), "feature");
});

test("git stores post-merge as executable", () => {
  assert.equal(storedMode("tools/git-hooks/post-merge"), "100755");
});
