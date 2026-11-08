// How many games CI's fuzz job plays. The whole 10,000 on main, and on a pull request that changes anything the fuzz
// plays or is built from: the engine, content, host and AI packages, the suites in tests/, the runner, or the root
// install. Any other pull request (app, server, docs, tools) plays 2,000: the checks job's gate already played 1,000
// when the core changed, and the nightly run plays 10,000 on main every night. When the change can't be read, 10,000.
//   node tools/gates/fuzz-games.mjs --all          prints 10000
//   node tools/gates/fuzz-games.mjs --base <sha>   prints 10000 or 2000 for the changes from <sha> to HEAD
import { spawnSync } from "node:child_process";
import path from "node:path";

export const FULL_GAMES = 10000;
export const PR_GAMES = 2000;

const CORE = [
  /^packages\/(engine|content|host|ai)\//,
  /^tests\//,
  /^tools\/gates\/(suites|fuzz-games)\.mjs$/,
  // The fuzz job's own settings (Node version, install) live in ci.yml.
  /^\.github\/workflows\/ci\.yml$/,
  /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|(vite|vitest)\.config\.[^/]+|vitest\.workspace\.[^/]+)$/,
];

// files: the changed paths, or null when they are unknown.
export function fuzzGames(files) {
  if (files === null) return FULL_GAMES;
  return files.some((f) => CORE.some((re) => re.test(f))) ? FULL_GAMES : PR_GAMES;
}

export function changedSince(root, base) {
  if (!/^[0-9a-f]{7,40}$/i.test(base ?? "")) return null;
  const r = spawnSync("git", ["diff", "--name-only", base, "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }); // NOSONAR (javascript:S4036)
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : null;
}

if (import.meta.main) {
  const ROOT = path.resolve(import.meta.dirname, "..", "..");
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--base");
  const files = argv.includes("--all") || at < 0 ? null : changedSince(ROOT, argv[at + 1]);
  process.stdout.write(`${fuzzGames(files)}\n`);
}
