// Tests for the supervisor's wake after a usage limit (wake.mjs, after-sprint fix 1), through `queue.mjs wake` and
// `window ids --wake`: when it is armed, when the hourly run at :02 covers it, and that it is kept across windows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { main } from "./queue.mjs";

const DOC_TEXT = readFileSync(path.join(import.meta.dirname, "fixtures", "october-sprint.md"), "utf8")
  .replace(/^\*\*Window \(UTC\):\*\*.*$/m, "**Window (UTC):** set by `/sprint-start`.")
  .replace("issue `#<n>` (filled in at setup)", "issue `#290`");
const START = new Date("2026-10-28T20:00:00Z");
const at = (iso) => String(Date.parse(iso) / 1000);

function cue() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "sprint-wake-"));
  const io = { dir, now: START };
  const run = (argv) => {
    const r = main(argv, { docText: DOC_TEXT, ...io });
    return { code: r.code, json: JSON.parse(r.out) };
  };
  return { io, run };
}

test("wake arms 2 minutes after the reset, rounded up to the minute, and moves the one on record", () => {
  const { run } = cue();
  assert.equal(run(["wake", "--resets-at", at("2026-10-28T22:10:00Z")]).json.reason, "no window is open");
  run(["window", "start", "10"]);
  const first = run(["wake", "--resets-at", at("2026-10-28T22:10:30Z")]).json;
  assert.deepEqual(first, {
    wake: null,
    arm: true,
    runOnceAt: "2026-10-28T22:13Z",
    reason: "create the wake, then record it with window ids --wake",
  });
  assert.equal(run(["window", "ids", "--wake", "trig_01W"]).json.wake, "trig_01W");
  assert.equal(run(["window", "ids", "--wake", "oops"]).code, 2, "not a trigger id");
  const moved = run(["wake", "--resets-at", at("2026-10-28T23:20:00Z")]).json;
  assert.deepEqual(
    [moved.arm, moved.wake, moved.runOnceAt, moved.reason],
    [true, "trig_01W", "2026-10-28T23:22Z", "move the wake"],
  );
});

test("the hourly run at :02 covers a wake up to 15 minutes before it, across the hour", () => {
  const { run } = cue();
  run(["window", "start", "10"]);
  for (const reset of ["2026-10-28T22:45:00Z", "2026-10-28T22:58:00Z", "2026-10-28T23:00:00Z"]) {
    const near = run(["wake", "--resets-at", at(reset)]).json;
    assert.equal(near.arm, false, reset);
    assert.match(near.reason, /hourly run at :02 covers/, reset);
  }
  assert.equal(
    run(["wake", "--resets-at", at("2026-10-28T22:44:00Z")]).json.arm,
    true,
    "22:46 is 16 minutes before 23:02",
  );
  assert.equal(run(["wake", "--resets-at", at("2026-10-28T23:01:00Z")]).json.arm, true, "23:03 is after the 23:02 run");
});

test("wake arms nothing for a reset that has passed, one after the window, or no reset time", () => {
  const { io, run } = cue();
  run(["window", "start", "10"]);
  assert.match(run(["wake", "--resets-at", at("2026-10-28T19:00:00Z")]).json.reason, /has passed/);
  assert.match(run(["wake", "--resets-at", at("2026-10-29T06:00:00Z")]).json.reason, /after the window ends/);
  for (const args of [[], ["--resets-at", "soon"]]) {
    const none = run(["wake", ...args]);
    assert.deepEqual([none.code, none.json.arm], [0, false]);
    assert.match(none.json.log, /no usage-limit reset time/);
  }
  io.now = new Date("2026-10-28T21:00:00Z");
  run(["window", "stop"]);
  assert.equal(
    run(["wake", "--resets-at", at("2026-10-28T23:20:00Z")]).json.arm,
    false,
    "a stopped window arms nothing",
  );
});

test("the wake is one standing trigger, kept across windows", () => {
  const { io, run } = cue();
  run(["window", "start", "10"]);
  run(["window", "ids", "--wake", "trig_01W"]);
  io.now = new Date("2026-10-29T21:00:00Z");
  run(["window", "archived"]);
  const next = run(["window", "start"]).json;
  assert.deepEqual([next.state, next.wake], ["open", "trig_01W"]);
});
