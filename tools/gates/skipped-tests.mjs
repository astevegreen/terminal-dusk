// Fails when any test is skipped, marked todo or focused with only, so every test always runs.
// `node tools/gates/skipped-tests.mjs` prints one line per marker (file:line: what it does and what to do) and exits 1.
// The held label never allows these. CI also catches tests that skip themselves in ways this can't see (test-count.mjs).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MARKER = "skip|only|todo|skipIf|runIf";
// it.skip(, test.concurrent.only(, describe.skipIf(x)(, and inside a test t.skip() or ctx.skip().
// A dot just before the name is left out, so a file name like deck.test.ts never counts.
const CHAIN = new RegExp(
  String.raw`(?<![\w$.])(describe|suite|it|test|bench|t|ctx|context)((?:\s*\.\s*[\w$]+)*?)\s*\.\s*(${MARKER})\b`,
  "dg",
);
// test("name", { skip: true }, ...), node:test and Vitest options, even across lines. A value of false is harmless.
const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\]|\\\\.)*`";
const OPTIONS = new RegExp(
  String.raw`(?<![\w$])(describe|suite|it|test)\s*\(\s*(?:${STRING}|[\w$.]+)\s*,\s*\{[^{}]*?(?<![\w$])(skip|only|todo)\s*:(?!\s*false\b)`,
  "dg",
);

const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const tidy = (s) => s.replace(/\s+/g, "");

// Every marker in one file's text, in order: { line, marker, focused }.
export function findMarkers(text) {
  const found = [];
  for (const m of text.matchAll(CHAIN)) {
    found.push({ index: m.indices[3][0], marker: tidy(`${m[1]}${m[2]}.${m[3]}`), focused: m[3] === "only" });
  }
  for (const m of text.matchAll(OPTIONS)) {
    found.push({ index: m.indices[2][0], marker: `${m[1]}(name, { ${m[2]} })`, focused: m[2] === "only" });
  }
  return found
    .toSorted((a, b) => a.index - b.index)
    .map(({ index, marker, focused }) => ({ line: lineAt(text, index), marker, focused }));
}

// Test files anywhere (*.test.* and *.spec.*), plus every code file under tests/ (helpers can hold tests too).
const CODE = /\.[cm]?[jt]sx?$/;
export const isTestFile = (rel) => CODE.test(rel) && (/\.(test|spec)\.[cm]?[jt]sx?$/.test(rel) || rel.startsWith("tests/"));

const advice = ({ marker, focused }) =>
  focused
    ? `${marker} focuses this test, so the other tests around it don't run. Remove the only.`
    : `${marker} stops this test from running. Make it pass, or delete it in a pull request the owner labels held.`;

// Scan every test file git knows about, including new files not added yet. Returns "file:line: advice" lines.
export function scanRepo(root) {
  // git comes from the developer's own PATH, as in every tool and hook in this repo: it is
  // installed in a different place on each machine, so there is no fixed path to use instead.
  const r = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { // NOSONAR (javascript:S4036)
    cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`git ls-files failed in ${root}: ${r.stderr}`);
  const files = [...new Set(r.stdout.split("\0"))].filter((f) => f && isTestFile(f) && existsSync(path.join(root, f)));
  return files.flatMap((f) => findMarkers(readFileSync(path.join(root, f), "utf8")).map((m) => `${f}:${m.line}: ${advice(m)}`));
}

if (import.meta.main) {
  const found = scanRepo(path.resolve(import.meta.dirname, "..", ".."));
  if (found.length) {
    process.stdout.write(found.join("\n") + "\n");
    process.exit(1);
  }
}
