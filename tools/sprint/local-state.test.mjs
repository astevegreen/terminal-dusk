// local-state's writes wait out Windows' brief locks on the renamed file (tools/rename-retry.mjs) instead of
// throwing. The window and trigger records themselves are tested through queue.mjs in cue.test.mjs.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readTriggers, readWindow, recordTrigger, writeWindow } from "./local-state.mjs";

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
const tempDir = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sprint-state-"));
  dirs.push(dir);
  return dir;
};

// A rename that Windows refuses with `code` twice, then lets through; `calls` counts its tries.
function heldTwice(code) {
  const fake = (from, to) => {
    fake.calls++;
    if (fake.calls < 3) throw Object.assign(new Error(code), { code });
    renameSync(from, to);
  };
  fake.calls = 0;
  return fake;
}

test("writeWindow retries a rename that Windows refuses for a moment, and leaves no temp file", () => {
  const dir = tempDir();
  const rename = heldTwice("EPERM");
  writeWindow(dir, { start: "a", end: "b" }, { rename });
  assert.equal(rename.calls, 3);
  assert.deepEqual(readWindow(dir), { start: "a", end: "b" });
  assert.deepEqual(readdirSync(dir), ["sprint-window.json"]);
});

test("recordTrigger retries a rename that Windows refuses for a moment, instead of losing the trigger", () => {
  const dir = tempDir();
  const rename = heldTwice("EBUSY");
  recordTrigger(dir, { title: "lane", id: "t1", at: 1 }, { rename });
  assert.equal(rename.calls, 3);
  assert.deepEqual(readTriggers(dir), [{ title: "lane", id: "t1", at: 1 }]);
});
