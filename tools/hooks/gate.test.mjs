import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHook, tempRepo, writeFiles, sh } from "./test-helpers.mjs";

// A fake pnpm on PATH: `pnpm --version` works, `pnpm gate` passes or fails on FAKE_GATE and logs each run.
const bin = mkdtempSync(path.join(os.tmpdir(), "td-fake-pnpm-"));
const log = path.join(bin, "runs.log");
writeFileSync(path.join(bin, "pnpm.mjs"), `
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("12.0.0"); process.exit(0); }
appendFileSync(${JSON.stringify(log)}, args.join(" ") + "\\n");
if (process.env.FAKE_GATE === "fail") { console.log("GATE FAILED at: unit and card tests\\npackages/engine/src/a.ts:3 expected 2, got 3\\nReproduce: pnpm test"); process.exit(1); }
`);
writeFileSync(path.join(bin, "pnpm.cmd"), `@node "%~dp0pnpm.mjs" %*\r\n`);
writeFileSync(path.join(bin, "pnpm"), `#!/bin/sh\nexec node "$(dirname "$0")/pnpm.mjs" "$@"\n`, { mode: 0o755 });

const PKG = { "package.json": JSON.stringify({ name: "t", private: true, scripts: { gate: "node gate.mjs" } }) };
const runs = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0);
const stop = (cwd, session_id, FAKE_GATE = "pass") =>
  runHook("gate.mjs", { cwd, session_id, hook_event_name: "Stop", stop_hook_active: false }, {
    env: { PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_GATE },
  });

test("finishes instantly when nothing changed", () => {
  const repo = tempRepo(PKG);
  const before = runs();
  const r = stop(repo, randomUUID());
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
  assert.equal(runs(), before, "pnpm gate should not run");
});

test("finishes instantly outside a git repository", () => {
  const r = stop(mkdtempSync(path.join(os.tmpdir(), "td-nogit-")), randomUUID());
  assert.equal(r.status, 0);
});

test("runs the gate when there are changes, and skips a repeat run on the same changes", () => {
  const repo = tempRepo(PKG);
  const id = randomUUID();
  writeFiles(repo, { "src/a.ts": "export const a = 2;\n" });
  const before = runs();
  assert.equal(stop(repo, id).status, 0);
  assert.equal(runs(), before + 1);
  assert.equal(stop(repo, id).status, 0);
  assert.equal(runs(), before + 1, "unchanged since the last green run");
  writeFiles(repo, { "src/a.ts": "export const a = 3;\n" });
  assert.equal(stop(repo, id).status, 0);
  assert.equal(runs(), before + 2, "changed again, so it runs again");
});

test("runs the gate for commits not yet on main", () => {
  const repo = tempRepo(PKG);
  const before = runs();
  writeFiles(repo, { "src/b.ts": "export const b = 1;\n" });
  sh("git", ["switch", "-q", "-c", "task/1"], repo);
  sh("git", ["add", "-A"], repo);
  sh("git", ["commit", "-q", "-m", "b"], repo);
  assert.equal(stop(repo, randomUUID()).status, 0);
  assert.equal(runs(), before + 1);
});

test("blocks finishing with the failures, then gives up after 5 blocks", () => {
  const repo = tempRepo(PKG);
  const id = randomUUID();
  writeFiles(repo, { "src/a.ts": "broken\n" });
  for (let i = 1; i <= 4; i++) {
    const r = stop(repo, id, "fail");
    assert.equal(r.status, 2);
    assert.match(r.stderr, new RegExp(`attempt ${i} of 5`));
    assert.match(r.stderr, /packages\/engine\/src\/a\.ts:3 expected 2, got 3/);
  }
  const fifth = stop(repo, id, "fail");
  assert.equal(fifth.status, 2);
  assert.match(fifth.stderr, /STATUS: GATE-FAILED/);
  assert.equal(stop(repo, id, "fail").status, 0, "the sixth stop is allowed");
});

test("a green run resets the block count", () => {
  const repo = tempRepo(PKG);
  const id = randomUUID();
  writeFiles(repo, { "src/a.ts": "v1\n" });
  stop(repo, id, "fail");
  stop(repo, id, "fail");
  assert.equal(stop(repo, id, "pass").status, 0);
  writeFiles(repo, { "src/a.ts": "v2\n" });
  assert.match(stop(repo, id, "fail").stderr, /attempt 1 of 5/);
});

test("without a gate script it warns the owner instead of blocking", () => {
  const repo = tempRepo({ "package.json": "{\"name\":\"t\"}" });
  writeFiles(repo, { "src/a.ts": "x\n" });
  const r = stop(repo, randomUUID());
  assert.equal(r.status, 0);
  assert.match(r.json?.systemMessage ?? "", /Gate not run: package\.json has no gate script/);
});
