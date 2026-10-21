// `pnpm gate`: check only what changed, stage by stage, stopping at the first failure.
// Prints nothing when green. On failure prints the stage, the first errors (at most 40 lines)
// and the command that reproduces it. `--all` checks everything (CI).
// Stages whose scripts don't exist yet are skipped, so the gate grows with the repo.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function git(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }); // NOSONAR (javascript:S4036)
  return r.status === 0 ? r.stdout.trim() : null;
}
const lines = (s) => (s ? s.split(/\r?\n/).filter(Boolean) : []);
const readJson = (f) => {
  try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; }
};

function changedFiles(root) {
  const base = ["origin/main", "main"].find((b) => git(root, ["rev-parse", "--verify", "-q", b]));
  const mergeBase = base && git(root, ["merge-base", base, "HEAD"]);
  const tracked = mergeBase
    ? git(root, ["diff", "--name-only", mergeBase])
    : (git(root, ["diff", "--name-only", "HEAD"]) ?? git(root, ["ls-files"]));
  return [...new Set([...lines(tracked), ...lines(git(root, ["ls-files", "--others", "--exclude-standard"]))])];
}

// Workspace packages: packages/<name> and shells/<name> folders with a package.json.
function workspaces(root) {
  return ["packages", "shells"].flatMap((dir) => {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(path.join(abs, d.name, "package.json")))
      .map((d) => ({ rel: `${dir}/${d.name}`, pkg: readJson(path.join(abs, d.name, "package.json")) ?? {} }));
  });
}

// The workspace packages a package.json depends on: its "workspace:" entries.
const workspaceDeps = (pkg) =>
  [pkg.dependencies, pkg.devDependencies].flatMap((deps) =>
    Object.entries(deps ?? {}).filter(([, version]) => String(version).startsWith("workspace:")).map(([name]) => name));

// The changed workspaces plus every workspace that depends on one of them, directly or through another.
function withDependants(all, changed) {
  const relOf = new Map(all.filter((w) => w.pkg.name).map((w) => [w.pkg.name, w.rel]));
  const picked = new Set(changed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of all) {
      if (!picked.has(w.rel) && workspaceDeps(w.pkg).some((name) => picked.has(relOf.get(name)))) {
        picked.add(w.rel);
        grew = true;
      }
    }
  }
  return all.map((w) => w.rel).filter((rel) => picked.has(rel));
}

// The stages to run, as [name, command or null], for `files` changed (null: everything).
export function selectStages(root, files) {
  const all = files === null;
  const touched = (prefix) => all || files.some((f) => f.startsWith(prefix));
  const rootWide = all || files.some((f) => /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/.test(f));
  const packages = workspaces(root);
  const affected = withDependants(packages, packages.map((w) => w.rel).filter((rel) => rootWide || touched(`${rel}/`)));
  const rootScripts = readJson(path.join(root, "package.json"))?.scripts ?? {};
  const isWorkspace = existsSync(path.join(root, "pnpm-workspace.yaml"));
  // tests/ holds the fuzz and golden suites, so a change there runs them.
  const core = ["packages/engine/", "packages/content/", "packages/host/", "tests/"].some(touched);

  const filters = affected.map((w) => `--filter "./${w}"`).join(" ");
  const perPackage = (script) => (isWorkspace && affected.length ? `pnpm ${filters} run --if-present ${script}` : null);
  const rootScript = (script) => (rootScripts[script] ? `pnpm run ${script}` : null);

  return [
    ["type check", perPackage("typecheck")],
    ["lint", perPackage("lint")],
    ["boundary check", rootScript("boundaries")],
    // Every change: a skipped, todo or focused test anywhere fails, and the held label never allows one.
    ["skipped tests", existsSync(path.join(root, "tools/gates/skipped-tests.mjs")) ? "node tools/gates/skipped-tests.mjs" : null],
    ["unit and card tests", perPackage("test")],
    // Quoted so Node expands the pattern itself. A .claude/ change counts too: the hook tests check its settings.
    ["tool tests", touched("tools/") || touched(".claude/") ? 'node --test "tools/**/*.test.mjs"' : null],
    ["content check", touched("packages/content/") ? rootScript("content:check") : null],
    ["quick fuzz", core ? rootScript("fuzz:quick") : null],
    ["golden replays", core ? rootScript("golden:check") : null],
  ];
}

// Prefer lines that point at a place in the code; fall back to the end of the output.
function firstErrors(output) {
  const all = lines(output);
  const located = [...new Set(all.filter((l) =>
    (/[\w./\\-]+\.\w+[:(]\d+/.test(l) && !/^\s*at .*(node:internal|node_modules|file:\/\/)/.test(l)) ||
    /^\s*(✖|not ok\b|FAIL\b|[\w.]*Error\b|error\b)/.test(l)))];
  const pick = located.length ? located : all.slice(-40);
  return pick.length > 40 ? [...pick.slice(0, 39), `... (${pick.length - 39} more)`] : pick;
}

if (import.meta.main) {
  const ROOT = path.resolve(import.meta.dirname, "..", "..");
  const files = process.argv.includes("--all") ? null : changedFiles(ROOT);
  if (files && files.length === 0) process.exit(0);

  for (const [stage, command] of selectStages(ROOT, files)) {
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
}
