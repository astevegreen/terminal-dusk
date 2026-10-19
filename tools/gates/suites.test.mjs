import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { findSuites, parseArgs, planRun } from "./suites.mjs";
import { writeFiles } from "../hooks/test-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const tempRoot = (files = {}) => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "td-suites-")));
  writeFiles(dir, files);
  return dir;
};
// A temp root that can really run suites: an ES-module package.json, the shared tsconfig and this repo's node_modules.
const runnableRoot = (files) => {
  const root = tempRoot({
    "package.json": JSON.stringify({ type: "module" }),
    "tests/tsconfig.json": JSON.stringify({ extends: "../tsconfig.base.json" }),
    ...files,
  });
  copyFileSync(path.join(ROOT, "tsconfig.base.json"), path.join(root, "tsconfig.base.json"));
  symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "junction");
  return root;
};
const exec = (step, cwd) =>
  spawnSync(step.command, step.args, { cwd, env: { ...process.env, ...step.env }, encoding: "utf8", windowsHide: true });

test("fuzz needs a positive whole number of games; golden takes only --update", () => {
  assert.deepEqual(parseArgs(["fuzz", "--games", "1000"]), { kind: "fuzz", games: 1000, update: false });
  assert.deepEqual(parseArgs(["golden", "--update"]), { kind: "golden", games: null, update: true });
  assert.throws(() => parseArgs(["fuzz"]), /needs --games/);
  assert.throws(() => parseArgs(["fuzz", "--games", "0"]), /whole number/);
  assert.throws(() => parseArgs(["golden", "--games", "5"]), /Unknown option/);
  assert.throws(() => parseArgs(["bench"]), /Usage/);
});

test("with no suites, the run says so and does nothing", () => {
  const plan = planRun(tempRoot(), { kind: "fuzz", games: 1000, update: false });
  assert.equal(plan.message, "No fuzz suites in tests/fuzz/ yet, so there is nothing to run.");
  assert.deepEqual(plan.steps, []);
});

test("suites are the *.test.ts files anywhere under tests/<kind>/", () => {
  const root = tempRoot({
    "tests/golden/a.test.ts": "",
    "tests/golden/deep/b.test.ts": "",
    "tests/golden/fixture.json": "{}",
    "tests/fuzz/c.test.ts": "",
  });
  assert.deepEqual(findSuites(root, "golden"), ["tests/golden/a.test.ts", "tests/golden/deep/b.test.ts"]);
});

test("golden --update re-records through Vitest -u and GOLDEN_UPDATE", () => {
  const root = tempRoot({ "tests/golden/a.test.ts": "" });
  const [typecheck, vitest] = planRun(root, { kind: "golden", games: null, update: true }).steps;
  assert.match(typecheck.args.join(" "), /tsc -p .*tests[\\/]tsconfig\.json$/);
  assert.deepEqual(vitest.args.slice(1), ["run", "--dir", "tests/golden", "-u"]);
  assert.deepEqual(vitest.env, { GOLDEN_UPDATE: "1" });
});

test("a fuzz run type-checks the suites, then runs them with FUZZ_GAMES set", () => {
  const root = runnableRoot({
    "tests/fuzz/games.test.ts": [
      'import { expect, it } from "vitest";',
      "const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;",
      'it("receives the number of games", () => { expect(env["FUZZ_GAMES"]).toBe("7"); });',
    ].join("\n"),
  });
  const steps = planRun(root, { kind: "fuzz", games: 7, update: false }).steps;
  assert.equal(steps.length, 2);
  for (const step of steps) {
    const r = exec(step, root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
});

test("a suite that fails the type check stops the run", () => {
  const root = runnableRoot({ "tests/fuzz/bad.test.ts": "export const n: number = 'not a number';\n" });
  const [typecheck] = planRun(root, { kind: "fuzz", games: 1, update: false }).steps;
  const r = exec(typecheck, root);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /bad\.test\.ts\(1,14\): error TS2322/);
});

const runGolden = (root) =>
  spawnSync(process.execPath, ["tools/gates/suites.mjs", "golden"], { cwd: root, encoding: "utf8", windowsHide: true });

test("the real runner runs every golden suite in the repository, and they pass", () => {
  const suites = findSuites(ROOT, "golden");
  assert.ok(suites.length > 0, "the repository has golden suites");
  const r = runGolden(ROOT);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // Vitest's summary line, with its colour codes taken out: every suite ran, and passed.
  const plain = r.stdout.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
  assert.match(plain, new RegExp(`Test Files\\s+${suites.length} passed \\(${suites.length}\\)`));
});

test("the real runner passes and says so when tests/golden/ has no suites", () => {
  // A copy of the runner in an empty root: it finds its root from its own place, two folders up.
  const root = tempRoot({ "tests/golden/fixture.json": "{}" });
  writeFiles(root, { "tools/gates/suites.mjs": readFileSync(path.join(ROOT, "tools/gates/suites.mjs"), "utf8") });
  const r = runGolden(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "No golden suites in tests/golden/ yet, so there is nothing to run.\n");
});
