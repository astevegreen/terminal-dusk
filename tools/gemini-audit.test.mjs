// The audit script's command line. The merge gate's rules are tested in tools/gemini/rails.test.mjs; these runs
// stop before any gh or agy call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "gemini-audit.mjs");
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", windowsHide: true });

test("the usage names the pr <n> merge gate", () => {
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: .*\| pr <n> \|/);
});

test("pr needs a pull request number", () => {
  for (const args of [["pr"], ["pr", "abc"]]) {
    const r = run(...args);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, /usage:/);
  }
});
