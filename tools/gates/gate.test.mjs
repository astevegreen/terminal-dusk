import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tempRepo, writeFiles } from "../hooks/test-helpers.mjs";

// A throwaway repository with a copy of the gate and two tool tests that always fail: one outside
// tools/hooks/ and one at the top of tools/. If the "tool tests" stage runs, the gate fails and names both.
const failing = (name) => `import { test } from "node:test";\ntest(${JSON.stringify(name)}, () => { throw new Error("tripwire"); });\n`;
const repoWithToolTests = () =>
  tempRepo({
    "tools/gates/gate.mjs": readFileSync(path.join(import.meta.dirname, "gate.mjs"), "utf8"),
    "tools/lib/nested.test.mjs": failing("nested tool test ran"),
    "tools/top.test.mjs": failing("top-level tool test ran"),
  });

// node --test marks the files it runs with NODE_TEST_CONTEXT, and a `node --test` started with it set
// skips every file and passes. Drop it so the gate runs the way `pnpm gate` does.
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const gate = (repo, args = []) =>
  spawnSync(process.execPath, ["tools/gates/gate.mjs", ...args], { cwd: repo, env, encoding: "utf8", windowsHide: true });

const assertToolTestsRan = (r) => {
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^GATE FAILED at: tool tests$/m);
  assert.match(r.stdout, /nested tool test ran/);
  assert.match(r.stdout, /top-level tool test ran/);
  assert.match(r.stdout, /^Reproduce: node --test "tools\/\*\*\/\*\.test\.mjs"$/m);
};

test("a change under tools/ runs every tool test, not just the hook tests", () => {
  const repo = repoWithToolTests();
  writeFiles(repo, { "tools/lib/helper.mjs": "export const x = 1;\n" });
  assertToolTestsRan(gate(repo));
});

test("a change to the Claude Code settings alone runs the tool tests", () => {
  const repo = repoWithToolTests();
  writeFiles(repo, { ".claude/settings.json": "{}\n" });
  assertToolTestsRan(gate(repo));
});

test("--all runs the tool tests even when nothing changed", () => {
  assertToolTestsRan(gate(repoWithToolTests(), ["--all"]));
});

test("a change outside tools/ and .claude/ leaves the tool tests out", () => {
  const repo = repoWithToolTests();
  writeFiles(repo, { "docs/notes.md": "notes\n" });
  const r = gate(repo);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "");
});

// A throwaway repository with the gate and the skipped-test scan. The fixture writes ^ for the dot,
// so this file never trips the scan itself.
const repoWithScan = () =>
  tempRepo({
    "tools/gates/gate.mjs": readFileSync(path.join(import.meta.dirname, "gate.mjs"), "utf8"),
    "tools/gates/skipped-tests.mjs": readFileSync(path.join(import.meta.dirname, "skipped-tests.mjs"), "utf8"),
  });

test("a skipped test anywhere fails the gate at the skipped tests stage", () => {
  const repo = repoWithScan();
  writeFiles(repo, { "packages/engine/src/deck.test.ts": `import { it } from "vitest";\nit^skip("draws", () => {});\n`.replaceAll("^", ".") });
  const r = gate(repo);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^GATE FAILED at: skipped tests$/m);
  assert.match(r.stdout, /^packages\/engine\/src\/deck\.test\.ts:2: /m);
  assert.match(r.stdout, /^Reproduce: node tools\/gates\/skipped-tests\.mjs$/m);
});

test("with no skipped tests the skipped tests stage passes silently", () => {
  const repo = repoWithScan();
  writeFiles(repo, { "packages/engine/src/deck.test.ts": `import { it } from "vitest";\nit("draws", () => {});\n` });
  const r = gate(repo);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "");
});
