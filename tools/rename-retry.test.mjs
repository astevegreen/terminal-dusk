import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { renameRetry } from "./rename-retry.mjs";

const failure = (code) => Object.assign(new Error(code), { code });

// A rename that fails with each code in turn, then does the real rename; `calls` counts its tries.
function flaky(...codes) {
  const fake = (from, to) => {
    fake.calls++;
    if (codes.length) throw failure(codes.shift());
    renameSync(from, to);
  };
  fake.calls = 0;
  return fake;
}

function tempFile() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "rename-retry-"));
  const from = path.join(dir, "a.tmp");
  writeFileSync(from, "new\n");
  return { from, to: path.join(dir, "a.json") };
}

test("a file Windows holds for a moment (EPERM, EBUSY, EACCES) is renamed on a later try", () => {
  const { from, to } = tempFile();
  const rename = flaky("EPERM", "EBUSY", "EACCES");
  const waits = [];
  renameRetry(from, to, { rename, wait: (ms) => waits.push(ms) });
  assert.equal(rename.calls, 4);
  assert.deepEqual(waits, [10, 20, 40]);
  assert.equal(readFileSync(to, "utf8"), "new\n");
  assert.equal(existsSync(from), false);
});

test("a file still held after five waits throws the last error", () => {
  const { from, to } = tempFile();
  const rename = flaky("EPERM", "EPERM", "EPERM", "EPERM", "EPERM", "EBUSY", "EPERM");
  const waits = [];
  assert.throws(() => renameRetry(from, to, { rename, wait: (ms) => waits.push(ms) }), { code: "EBUSY" });
  assert.equal(rename.calls, 6);
  assert.deepEqual(waits, [10, 20, 40, 80, 160]);
  assert.equal(existsSync(from), true);
});

test("any other failure, such as a missing file, throws at once without waiting", () => {
  const { from, to } = tempFile();
  const waits = [];
  assert.throws(() => renameRetry(`${from}.gone`, to, { wait: (ms) => waits.push(ms) }), { code: "ENOENT" });
  assert.deepEqual(waits, []);
});

test("with no fakes it renames for real, replacing the old file, and its default wait really waits", () => {
  const { from, to } = tempFile();
  writeFileSync(to, "old\n");
  renameRetry(from, to);
  assert.equal(readFileSync(to, "utf8"), "new\n");
  const second = tempFile();
  const start = performance.now();
  renameRetry(second.from, second.to, { rename: flaky("EPERM") });
  assert.ok(performance.now() - start >= 9, "the first retry waits about 10ms");
});
