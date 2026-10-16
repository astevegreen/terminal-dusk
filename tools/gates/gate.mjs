// `pnpm gate`: check only what changed, stage by stage, stopping at the first failure.
// Prints nothing when green. On failure prints the stage, the first errors (at most 40 lines)
// and the command that reproduces it. `--all` checks everything (CI).
// Stages whose scripts don't exist yet are skipped, so the gate grows with the repo.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ALL = process.argv.includes("--all");

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : null;
}
const lines = (s) => (s ? s.split(/\r?\n/).filter(Boolean) : []);
const readJson = (f) => {
  try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; }
};

function changedFiles() {
  const base = ["origin/main", "main"].find((b) => git(["rev-parse", "--verify", "-q", b]));
  const mergeBase = base && git(["merge-base", base, "HEAD"]);
  const tracked = mergeBase
    ? git(["diff", "--name-only", mergeBase])
    : (git(["diff", "--name-only", "HEAD"]) ?? git(["ls-files"]));
  return [...new Set([...lines(tracked), ...lines(git(["ls-files", "--others", "--exclude-standard"]))])];
}

// Workspace packages: packages/<name> and shells/<name> folders with a package.json.
const workspaces = ["packages", "shells"].flatMap((dir) => {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(abs, d.name, "package.json")))
    .map((d) => `${dir}/${d.name}`);
});

const files = ALL ? null : changedFiles();
if (files && files.length === 0) process.exit(0);
const touched = (prefix) => ALL || files.some((f) => f.startsWith(prefix));
const rootWide = ALL || files.some((f) => /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/.test(f));
const affected = workspaces.filter((w) => rootWide || touched(`${w}/`));
const rootScripts = readJson(path.join(ROOT, "package.json"))?.scripts ?? {};
const isWorkspace = existsSync(path.join(ROOT, "pnpm-workspace.yaml"));
const core = touched("packages/engine/") || touched("packages/content/") || touched("packages/host/");

const filters = affected.map((w) => `--filter "./${w}"`).join(" ");
const perPackage = (script) => (isWorkspace && affected.length ? `pnpm ${filters} run --if-present ${script}` : null);
const rootScript = (script) => (rootScripts[script] ? `pnpm run ${script}` : null);

const stages = [
  ["type check", perPackage("typecheck")],
  ["lint", perPackage("lint")],
  ["boundary check", rootScript("boundaries")],
  ["unit and card tests", perPackage("test")],
  ["hook tests", touched("tools/") ? "node --test tools/hooks/*.test.mjs" : null],
  ["content check", touched("packages/content/") ? rootScript("content:check") : null],
  ["quick fuzz", core ? rootScript("fuzz:quick") : null],
  ["golden replays", core ? rootScript("golden:check") : null],
];

// Prefer lines that point at a place in the code; fall back to the end of the output.
function firstErrors(output) {
  const all = lines(output);
  const located = [...new Set(all.filter((l) =>
    (/[\w./\\-]+\.\w+[:(]\d+/.test(l) && !/^\s*at .*(node:internal|node_modules|file:\/\/)/.test(l)) ||
    /^\s*(✖|not ok\b|FAIL\b|[\w.]*Error\b|error\b)/.test(l)))];
  const pick = located.length ? located : all.slice(-40);
  return pick.length > 40 ? [...pick.slice(0, 39), `... (${pick.length - 39} more)`] : pick;
}

for (const [stage, command] of stages) {
  if (!command) continue;
  const r = spawnSync(command, {
    cwd: ROOT, shell: true, encoding: "utf8", windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  if (r.status !== 0) {
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    process.stdout.write([`GATE FAILED at: ${stage}`, ...firstErrors(out), `Reproduce: ${command}`].join("\n") + "\n");
    process.exit(1);
  }
}
