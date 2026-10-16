import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareCounts, countTests, heldByOwner } from "./test-count.mjs";
import { writeFiles } from "../hooks/test-helpers.mjs";

// Fixtures write ^ for the dot, so this file never trips the skipped-test scan.
const code = (text) => text.replaceAll("^", ".");
const REPO = path.resolve(import.meta.dirname, "..", "..");
const tempDir = () => realpathSync(mkdtempSync(path.join(os.tmpdir(), "td-count-test-")));
const counts = (files, skipped = []) => ({ total: Object.values(files).reduce((a, b) => a + b, 0), files, skipped });

test("fewer tests than the base branch fails and names every file that lost tests", () => {
  const base = counts({ "a.test.ts": 3, "b.test.ts": 2, "c.test.ts": 1 });
  const head = counts({ "a.test.ts": 3, "b.test.ts": 1 });
  const report = compareCounts(base, head).join("\n");
  assert.match(report, /Fewer tests than the base branch: 6 there, 4 here/);
  assert.match(report, /b\.test\.ts: 2 -> 1/);
  assert.match(report, /c\.test\.ts: 1 -> 0/);
  assert.doesNotMatch(report, /a\.test\.ts/);
  assert.match(report, /Only the repository owner can allow fewer tests, by labelling the pull request held/);
});

test("the same number of tests or more passes, even when tests moved between files", () => {
  const base = counts({ "a.test.ts": 3, "b.test.ts": 2 });
  assert.deepEqual(compareCounts(base, counts({ "a.test.ts": 3, "b.test.ts": 2 })), []);
  assert.deepEqual(compareCounts(base, counts({ "a.test.ts": 1, "d.test.ts": 9 })), []);
});

test("held by the owner allows fewer tests", () => {
  const base = counts({ "a.test.ts": 3 });
  assert.deepEqual(compareCounts(base, counts({ "a.test.ts": 1 }), { held: true }), []);
});

test("a skipped or todo test fails even with more tests, and even when held", () => {
  const base = counts({ "a.test.ts": 1 });
  const head = counts({ "a.test.ts": 2 }, ["a.test.ts > deck > draws"]);
  for (const held of [false, true]) {
    const report = compareCounts(base, head, { held }).join("\n");
    assert.match(report, /a\.test\.ts > deck > draws/);
    assert.doesNotMatch(report, /Fewer tests/);
  }
});

const event = (kind, login, label = "held") => ({ event: kind, actor: { login }, label: { name: label } });

test("only a held label the owner added counts", () => {
  assert.equal(heldByOwner([event("labeled", "astevegreen")], "astevegreen"), true);
  assert.equal(heldByOwner([event("labeled", "greenbeanbot")], "astevegreen"), false);
  assert.equal(heldByOwner([event("labeled", "astevegreen", "bug")], "astevegreen"), false);
  assert.equal(heldByOwner([], "astevegreen"), false);
});

test("the latest change to the held label decides", () => {
  const owner = event("labeled", "astevegreen");
  assert.equal(heldByOwner([owner, event("unlabeled", "greenbeanbot")], "astevegreen"), false);
  assert.equal(heldByOwner([owner, event("unlabeled", "greenbeanbot"), event("labeled", "greenbeanbot")], "astevegreen"), false);
  assert.equal(heldByOwner([event("labeled", "greenbeanbot"), event("unlabeled", "greenbeanbot"), owner], "astevegreen"), true);
  assert.equal(heldByOwner([owner, event("labeled", "astevegreen", "bug"), event("commented", "greenbeanbot")], "astevegreen"), true);
});

// A throwaway folder with tool tests: 5 in a.test.mjs (a subtest counts, the suite around "three" doesn't,
// a failing test still counts) and 2 in b.test.mjs, one of which skips itself while running.
function toolTestsFolder() {
  const dir = tempDir();
  writeFiles(dir, {
    "tools/a.test.mjs": [
      `import { describe, test } from "node:test";`,
      `test("one", () => {});`,
      `test("two", async (t) => { await t.test("two, part a", () => {}); });`,
      `describe("deck", () => { test("three", () => {}); });`,
      `test("fails on purpose", () => { throw new Error("still counted"); });`,
    ].join("\n"),
    "tools/lib/b.test.mjs": code(`import { test } from "node:test";\ntest("runs", () => {});\ntest("stops itself", (t) => { t^skip("why"); });\n`),
  });
  return dir;
}

test("counts every tool test that runs, and lists the ones that skip themselves", () => {
  assert.deepEqual(countTests(toolTestsFolder()), {
    total: 7,
    files: { "tools/a.test.mjs": 5, "tools/lib/b.test.mjs": 2 },
    skipped: ["tools/lib/b.test.mjs > stops itself"],
  });
});

test("counts Vitest tests in each package and in tests/, one per table row, with the fuzz suites at one game", (t) => {
  const dir = tempDir();
  mkdirSync(path.join(dir, "node_modules"));
  const vitest = path.join(dir, "node_modules", "vitest");
  symlinkSync(realpathSync(path.join(REPO, "node_modules", "vitest")), vitest, "junction");
  t.after(() => unlinkSync(vitest));
  writeFiles(dir, {
    "packages/demo/package.json": JSON.stringify({ name: "demo", private: true, type: "module", scripts: { test: "vitest run" } }),
    "packages/demo/src/a.test.ts": code([
      `import { expect, test } from "vitest";`,
      `test("draws", () => { expect(1).toBe(1); });`,
      `test^each([1, 2, 3])("row %i", (n) => { expect(n).toBeGreaterThan(0); });`,
      `test("stops itself", (ctx) => { ctx^skip(); });`,
    ].join("\n")),
    "packages/docs-only/package.json": JSON.stringify({ name: "docs-only", private: true }),
    "tests/fuzz/games.test.ts": [
      `import { test } from "vitest";`,
      `const games = Number(process.env.FUZZ_GAMES ?? 100);`,
      "for (let i = 0; i < games; i++) test(`game ${i}`, () => {});",
    ].join("\n"),
  });
  assert.deepEqual(countTests(dir), {
    total: 6,
    files: { "packages/demo/src/a.test.ts": 5, "tests/fuzz/games.test.ts": 1 },
    skipped: ["packages/demo/src/a.test.ts > stops itself"],
  });
});

test("a package whose tests aren't run by Vitest can't be counted, so counting stops", () => {
  const dir = tempDir();
  writeFiles(dir, { "packages/odd/package.json": JSON.stringify({ name: "odd", scripts: { test: "jest" } }) });
  assert.throws(() => countTests(dir), /packages\/odd.*can't count/);
});

// The command line, the way CI runs it: save the base branch's counts, then compare this branch's against them.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const cli = (args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "test-count.mjs"), ...args], { env, encoding: "utf8", windowsHide: true });

test("--save writes the counts and prints nothing", () => {
  const dir = toolTestsFolder();
  const out = path.join(dir, "counts.json");
  const r = cli(["--root", dir, "--save", out]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "");
  assert.equal(JSON.parse(readFileSync(out, "utf8")).total, 7);
});

test("--compare fails on fewer tests unless the owner labelled the pull request held", () => {
  const dir = tempDir();
  writeFiles(dir, { "tools/a.test.mjs": `import { test } from "node:test";\ntest("one", () => {});\ntest("two", () => {});\n` });
  const base = path.join(dir, "base.json");
  writeFileSync(base, JSON.stringify(counts({ "tools/a.test.mjs": 3 })));
  const events = (login) => {
    const file = path.join(dir, `events-${login}.ndjson`);
    writeFileSync(file, [event("labeled", login), event("labeled", login, "bug")].map((e) => JSON.stringify(e)).join("\n") + "\n");
    return file;
  };

  const fewer = cli(["--root", dir, "--compare", base]);
  assert.equal(fewer.status, 1, fewer.stdout + fewer.stderr);
  assert.match(fewer.stdout, /Fewer tests than the base branch: 3 there, 2 here/);
  assert.match(fewer.stdout, /tools\/a\.test\.mjs: 3 -> 2/);

  const ownerHeld = cli(["--root", dir, "--compare", base, "--held-events", events("astevegreen"), "--owner", "astevegreen"]);
  assert.equal(ownerHeld.status, 0, ownerHeld.stdout + ownerHeld.stderr);
  assert.equal(ownerHeld.stdout, "");

  const botHeld = cli(["--root", dir, "--compare", base, "--held-events", events("greenbeanbot"), "--owner", "astevegreen"]);
  assert.equal(botHeld.status, 1, botHeld.stdout + botHeld.stderr);
  assert.match(botHeld.stdout, /Fewer tests than the base branch/);
});
