// Counts the tests by running them: Vitest in each package and in tests/, node:test in tools/.
// CI saves the base branch's counts, then fails a pull request that has fewer tests, unless the repository owner
// labelled it held, and fails any test that skipped itself while running, held or not. Prints nothing when green.
//   node tools/gates/test-count.mjs [--root <dir>] --save <file>
//   node tools/gates/test-count.mjs [--root <dir>] --compare <base file> [--held-events <file> --owner <login>]
// Running is the only reliable count: `vitest list` leaves out skipped tests and counts a test.each table as one test,
// and node:test has no list mode at all.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPORTER = path.join(import.meta.dirname, "count-reporter.mjs");
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const posix = (p) => p.split(path.sep).join("/");
// Sorts text the same way on every machine (by character code, not by the machine's language settings).
function byText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// The fuzz suites play one game each, so both branches count the same way, fast. Golden replays are checked, not re-recorded.
function childEnv() {
  const env = { ...process.env, FUZZ_GAMES: "1", FORCE_COLOR: "0", NO_COLOR: "1" };
  delete env.GOLDEN_UPDATE;
  delete env.NODE_TEST_CONTEXT; // set inside node --test, and it would make the tool tests skip every file
  return env;
}

function run(args, cwd) {
  return spawnSync(process.execPath, args, { cwd, env: childEnv(), encoding: "utf8", windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
}
const tail = (r) => `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split(/\r?\n/).slice(-20).join("\n");

// Files under dir that match, skipping node_modules and dot folders.
function walk(dir, keep) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === "node_modules" || d.name.startsWith(".")) return [];
    const abs = path.join(dir, d.name);
    if (d.isDirectory()) return walk(abs, keep);
    return keep(d.name) ? [abs] : [];
  });
}

// The installed Vitest nearest to dir, the way `pnpm test` finds it.
function findVitest(dir, root) {
  for (;;) {
    const bin = path.join(dir, "node_modules", "vitest", "vitest.mjs");
    if (existsSync(bin)) return bin;
    if (dir === root || path.dirname(dir) === dir) return null;
    dir = path.dirname(dir);
  }
}

// The arguments of a plain "vitest run ..." test script; anything else can't be counted.
function vitestArgs(script, label) {
  const m = /^vitest(?:\s+run)?((?:\s+[\w@./=:-]+)*)$/.exec(script.trim());
  if (!m) throw new Error(`${label}: can't count its tests, because its test script "${script}" isn't a plain "vitest run".`);
  return ["run", ...m[1].trim().split(/\s+/).filter(Boolean)];
}

// One { file, name, skipped } per test Vitest ran (failing tests count too), from its JSON report.
function vitestTests(root, cwd, args, out, label) {
  const bin = findVitest(cwd, root);
  if (!bin) throw new Error(`${label}: can't count its tests, because Vitest isn't installed. Run pnpm install.`);
  const r = run([bin, ...args, "--reporter=json", `--outputFile=${out}`, "--passWithNoTests"], cwd);
  if (!existsSync(out)) throw new Error(`${label}: can't count its tests, because Vitest wrote no report:\n${tail(r)}`);
  return readJson(out).testResults.flatMap((file) =>
    file.assertionResults.map((t) => ({
      file: file.name,
      name: [...t.ancestorTitles, t.title].join(" > "),
      skipped: t.status !== "passed" && t.status !== "failed",
    })),
  );
}

// One { file, name, skipped } per tool test node:test ran, through count-reporter.mjs.
function nodeTests(root, out) {
  const r = run(
    ["--test", `--test-reporter=${pathToFileURL(REPORTER).href}`, `--test-reporter-destination=${out}`, "tools/**/*.test.mjs"],
    root,
  );
  if (!existsSync(out)) throw new Error(`tools/: can't count the tool tests, because node --test wrote no report:\n${tail(r)}`);
  return readFileSync(out, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

// Run every test under root and count them: { total, files: { "path/of.test.ts": n }, skipped: ["file > name"] }.
export function countTests(rootDir) {
  const root = realpathSync(path.resolve(rootDir));
  const tmp = mkdtempSync(path.join(os.tmpdir(), "td-test-count-"));
  try {
    const tests = [];
    const packages = ["packages", "shells"].flatMap((dir) => {
      const abs = path.join(root, dir);
      if (!existsSync(abs)) return [];
      return readdirSync(abs, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(path.join(abs, d.name, "package.json")))
        .map((d) => `${dir}/${d.name}`);
    });
    for (const [i, pkg] of packages.entries()) {
      const script = readJson(path.join(root, pkg, "package.json")).scripts?.test;
      if (!script) continue;
      tests.push(...vitestTests(root, path.join(root, pkg), vitestArgs(script, pkg), path.join(tmp, `vitest-${i}.json`), pkg));
    }
    if (walk(path.join(root, "tests"), (name) => TEST_FILE.test(name)).length) {
      tests.push(...vitestTests(root, root, ["run", "--dir", "tests"], path.join(tmp, "vitest-tests.json"), "tests/"));
    }
    if (walk(path.join(root, "tools"), (name) => name.endsWith(".test.mjs")).length) {
      tests.push(...nodeTests(root, path.join(tmp, "node-test.ndjson")));
    }

    const files = {};
    const skipped = [];
    for (const t of tests) {
      const rel = t.file ? posix(path.relative(root, path.resolve(t.file))) : "(no file)";
      files[rel] = (files[rel] ?? 0) + 1;
      if (t.skipped) skipped.push(`${rel} > ${t.name}`);
    }
    const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => byText(a, b)));
    return { total: tests.length, files: sorted, skipped: skipped.toSorted(byText) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// What's wrong with head compared with base, as lines to print; empty when it passes.
// held lifts only the fewer-tests check. A test that skipped itself always fails.
export function compareCounts(base, head, { held = false } = {}) {
  const problems = [];
  if (head.skipped.length) {
    problems.push(
      "These tests were skipped or marked todo while running. Tests must run, and the held label doesn't change that:",
      ...head.skipped.map((name) => `  ${name}`),
    );
  }
  if (head.total < base.total && !held) {
    const files = [...new Set([...Object.keys(base.files), ...Object.keys(head.files)])].sort(byText);
    const before = (f) => base.files[f] ?? 0;
    const after = (f) => head.files[f] ?? 0;
    problems.push(
      `Fewer tests than the base branch: ${base.total} there, ${head.total} here. Files whose count changed:`,
      ...files.filter((f) => before(f) !== after(f)).map((f) => `  ${f}: ${before(f)} -> ${after(f)}`),
      "Only the repository owner can allow fewer tests, by labelling the pull request held.",
    );
  }
  return problems;
}

// GitHub issue events for the pull request, oldest first. Held counts only while the latest change to the
// held label is the owner adding it; a held label the night shift added or removed doesn't count.
export function heldByOwner(events, owner) {
  const last = events
    .filter((e) => (e.event === "labeled" || e.event === "unlabeled") && e.label?.name?.toLowerCase() === "held")
    .toSorted((a, b) => byText(a.created_at ?? "", b.created_at ?? ""))
    .at(-1);
  return last?.event === "labeled" && last.actor?.login?.toLowerCase() === owner.toLowerCase();
}

// One event per line, as `gh api --jq '.[] | tojson'` prints them.
function readEvents(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const value = JSON.parse(line);
    return typeof value === "string" ? JSON.parse(value) : value;
  });
}

if (import.meta.main) {
  const option = (name) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? null : process.argv[i + 1];
  };
  try {
    const [save, compare, eventsFile, owner] = ["--save", "--compare", "--held-events", "--owner"].map(option);
    if (Boolean(save) === Boolean(compare)) throw new Error("Pass either --save <file> or --compare <base file>.");
    if (eventsFile && !owner) throw new Error("--held-events needs --owner <login>.");
    const counts = countTests(option("--root") ?? path.resolve(import.meta.dirname, "..", ".."));
    if (save) {
      writeFileSync(save, JSON.stringify(counts, null, 2) + "\n");
    } else {
      const held = eventsFile ? heldByOwner(readEvents(eventsFile), owner) : false;
      const problems = compareCounts(readJson(compare), counts, { held });
      if (problems.length) {
        process.stdout.write(problems.join("\n") + "\n");
        process.exit(1);
      }
    }
  } catch (error) {
    process.stdout.write(`${error.message}\n`);
    process.exit(1);
  }
}
