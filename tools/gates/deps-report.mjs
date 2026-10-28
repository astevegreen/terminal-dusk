// CI's dependency check (the `deps` job), which replaced the owner's review of package.json and the lockfile
// (owner's policy, 28 Oct 2026). It compares this commit with the base:
//   - the new-dependency report: every dependency added, removed or changed in a workspace package.json or the
//     pnpm catalog, written to the job summary so a reader sees what came in and from where;
//   - `pnpm audit` on both: it fails only on a high or critical advisory the base didn't have, so an advisory
//     published upstream for a package main already uses never blocks unrelated pull requests. An audit that
//     can't reach the registry fails when the change touches dependencies (a manifest, the catalog or the
//     lockfile), since nothing else checks what came in; on any other change it warns and passes.
// Usage: node tools/gates/deps-report.mjs --base <base checkout> [--head <dir>]   (exit 1 on a new advisory)
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const FAIL_LEVELS = ["high", "critical"];
const FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

// Every workspace manifest's dependencies, keyed "<package.json path> <field> <name>", plus the catalog's.
export function manifests(root) {
  const deps = new Map();
  const dirs = [".", ...["packages", "shells"].flatMap((d) => listDirs(path.join(root, d)).map((s) => `${d}/${s}`))];
  for (const dir of dirs) {
    const file = path.join(root, dir, "package.json");
    if (!existsSync(file)) continue;
    const json = JSON.parse(readFileSync(file, "utf8"));
    const where = dir === "." ? "package.json" : `${dir}/package.json`;
    for (const field of FIELDS)
      for (const [name, version] of Object.entries(json[field] ?? {})) deps.set(`${where} ${field} ${name}`, version);
  }
  for (const [name, version] of catalog(path.join(root, "pnpm-workspace.yaml")))
    deps.set(`pnpm-workspace.yaml catalog ${name}`, version);
  return deps;
}

function listDirs(dir) {
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
}

// The `catalog:` block of pnpm-workspace.yaml: one "name: version" per indented line.
export function catalog(file) {
  if (!existsSync(file)) return [];
  const out = [];
  let inside = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^catalog:\s*$/.test(line)) inside = true;
    else if (inside && /^\S/.test(line)) inside = false;
    else if (inside) {
      const m = /^\s+("?)([^":#]+)\1:\s*("?)([^"#\s]+)\3/.exec(line);
      if (m) out.push([m[2].trim(), m[4]]);
    }
  }
  return out;
}

// Added, removed and changed dependencies between two manifests() maps.
export function depChanges(base, head) {
  const added = [...head].filter(([k]) => !base.has(k)).map(([key, to]) => ({ key, to }));
  const removed = [...base].filter(([k]) => !head.has(k)).map(([key, from]) => ({ key, from }));
  const changed = [...head]
    .filter(([k, v]) => base.has(k) && base.get(k) !== v)
    .map(([key, to]) => ({ key, from: base.get(key), to }));
  return { added, removed, changed };
}

// The advisories in a `pnpm audit --json` answer, as "<id> <module>" keys, or null when it isn't one.
export function advisories(text) {
  try {
    const json = JSON.parse(text);
    if (!json || typeof json.advisories !== "object") return null;
    return Object.values(json.advisories).map((a) => ({
      key: `${a.id} ${a.module_name}`,
      severity: a.severity,
      title: a.title,
      module: a.module_name,
      url: a.url,
    }));
  } catch {
    return null;
  }
}

// High or critical advisories in head that base didn't have.
export function newAdvisories(base, head) {
  const before = new Set(base.map((a) => a.key));
  return head.filter((a) => FAIL_LEVELS.includes(a.severity) && !before.has(a.key));
}

// True when the two checkouts' pnpm-lock.yaml differ: a dependency moved even if no manifest did.
export function lockfileChanged(baseRoot, headRoot) {
  const read = (root) => {
    const file = path.join(root, "pnpm-lock.yaml");
    return existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
  };
  return read(baseRoot) !== read(headRoot);
}

// changes: depChanges() plus lockfile (true when pnpm-lock.yaml changed); base, head: advisories(), or null when
// pnpm audit gave no answer.
export function report({ changes, base, head }) {
  const lines = ["## Dependencies", ""];
  const { added, removed, changed, lockfile = false } = changes;
  const touched = added.length > 0 || removed.length > 0 || changed.length > 0 || lockfile;
  if (!touched) lines.push("No dependency added, removed or changed.");
  for (const a of added) lines.push(`- added: ${a.key} ${a.to}`);
  for (const r of removed) lines.push(`- removed: ${r.key} ${r.from}`);
  for (const c of changed) lines.push(`- changed: ${c.key} ${c.from} -> ${c.to}`);
  if (lockfile) lines.push("- pnpm-lock.yaml changed");
  lines.push("", "## pnpm audit", "");
  if (!head || !base) {
    if (touched) {
      lines.push(
        "Failed: pnpm audit gave no answer (registry unreachable?), and this change touches dependencies, so what " +
          "came in was not checked for advisories. Run the job again once the registry answers.",
      );
      return { text: lines.join("\n"), fail: true };
    }
    lines.push(
      "Warning: pnpm audit gave no answer (registry unreachable?), so no advisory was compared this run. This change " +
        "touches no dependency, so it passes.",
    );
    return { text: lines.join("\n"), fail: false };
  }
  const fresh = newAdvisories(base, head);
  const known = head.filter((a) => !fresh.includes(a));
  for (const a of fresh) lines.push(`- NEW ${a.severity}: ${a.module}: ${a.title} ${a.url}`);
  for (const a of known) lines.push(`- known (also on the base, or below high): ${a.severity}: ${a.module}: ${a.title}`);
  if (!head.length) lines.push("No advisories.");
  lines.push("", fresh.length ? `Failed: ${fresh.length} new high or critical advisory.` : "No new high or critical advisory.");
  return { text: lines.join("\n"), fail: fresh.length > 0 };
}

function audit(dir) {
  const r = spawnSync("pnpm", ["audit", "--json"], { cwd: dir, encoding: "utf8", shell: process.platform === "win32", windowsHide: true }); // NOSONAR (javascript:S4036)
  return advisories(r.stdout);
}

if (import.meta.main) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i < 0 ? undefined : process.argv[i + 1];
  };
  const baseDir = arg("--base");
  const headDir = arg("--head") ?? process.cwd();
  if (!baseDir) {
    console.error("usage: node tools/gates/deps-report.mjs --base <base checkout> [--head <dir>]");
    process.exit(2);
  }
  const r = report({
    changes: { ...depChanges(manifests(baseDir), manifests(headDir)), lockfile: lockfileChanged(baseDir, headDir) },
    base: audit(baseDir),
    head: audit(headDir),
  });
  console.log(r.text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${r.text}\n`);
  process.exit(r.fail ? 1 : 0);
}
