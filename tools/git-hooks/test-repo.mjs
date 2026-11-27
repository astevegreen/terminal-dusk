// A throwaway repository for the tests of the git hooks that write docs/repo-map.md.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sh, tempRepo, writeFiles } from "../hooks/test-helpers.mjs";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const MAP = "docs/repo-map.md";

// A repository with the map generator and one of this repo's git hooks committed, the map ignored and hooks turned on.
export function repoWithHook(hook, { ignored = [MAP] } = {}) {
  const repo = tempRepo({ ".gitignore": ignored.map((line) => `${line}\n`).join("") });
  // This repository checks files out with LF endings (.gitattributes), whatever the machine's own setting is.
  sh("git", ["config", "core.autocrlf", "false"], repo);
  for (const rel of ["tools/repo-map.mjs", `tools/git-hooks/${hook}`]) {
    mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    copyFileSync(path.join(ROOT, rel), path.join(repo, rel));
  }
  commit(repo, "add the hook");
  sh("git", ["config", "core.hooksPath", "tools/git-hooks"], repo);
  return repo;
}

export function commit(repo, message, files = {}) {
  writeFiles(repo, files);
  sh("git", ["add", "-A"], repo);
  sh("git", ["commit", "-q", "-m", message], repo);
}

// Makes `branch` with one more commit, then goes back to main, running no hooks on the way.
export function branchWith(repo, branch, files) {
  const quiet = ["-c", "core.hooksPath=no-hooks"];
  sh("git", [...quiet, "switch", "-q", "-c", branch], repo);
  commit(repo, branch, files);
  sh("git", [...quiet, "switch", "-q", "main"], repo);
}

export const mapOf = (dir) => readFileSync(path.join(dir, MAP), "utf8");

// The file mode git stores for a file of this repository: Linux and macOS skip a hook that isn't executable.
export const storedMode = (file) => sh("git", ["ls-files", "-s", file], ROOT).split(" ")[0];
