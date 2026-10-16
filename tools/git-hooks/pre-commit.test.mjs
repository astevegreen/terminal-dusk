import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import { sh, tempRepo, writeFiles } from "../hooks/test-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const COPY = [
  "package.json",
  ".prettierrc.json",
  ".prettierignore",
  "tools/repo-map.mjs",
  "tools/git-hooks/pre-commit",
];

// A throwaway repository with this repo's hook, formatting settings and node_modules, hooks turned on.
function repoWithHook() {
  const repo = tempRepo();
  for (const rel of COPY) {
    mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    copyFileSync(path.join(ROOT, rel), path.join(repo, rel));
  }
  symlinkSync(path.join(ROOT, "node_modules"), path.join(repo, "node_modules"), "junction");
  writeFiles(repo, { ".gitignore": "node_modules\n" });
  sh("git", ["config", "core.hooksPath", "tools/git-hooks"], repo);
  return repo;
}
const committed = (repo, file) => sh("git", ["show", `HEAD:${file}`], repo);

test("a commit formats the staged code, leaves Locked files alone and refreshes the repo map", () => {
  const repo = repoWithHook();
  const locked = "#  Rules\n*   keep   this   exactly\n";
  writeFiles(repo, {
    "packages/engine/src/a.ts": "// Adds one.\nexport const add  =  (n:number)=>n+1\n",
    "CLAUDE.md": locked,
  });
  sh("git", ["add", "-A"], repo);
  sh("git", ["commit", "-q", "-m", "test"], repo);

  assert.equal(committed(repo, "packages/engine/src/a.ts"), "// Adds one.\nexport const add = (n: number) => n + 1;");
  assert.equal(committed(repo, "CLAUDE.md"), locked.trimEnd());
  assert.match(committed(repo, "docs/repo-map.md"), /`packages\/engine\/src\/a\.ts` - Adds one\. Exports: add\./);
  assert.equal(sh("git", ["status", "--porcelain"], repo), "");
  assert.equal(readFileSync(path.join(repo, "CLAUDE.md"), "utf8"), locked);
});
