// Tests for the sprint's cue (cue.mjs, local-state.mjs) through `queue.mjs`: the window /sprint-start opens on
// this computer, the night shift standing down inside it, the supervisor's recorded triggers, and the memory it
// keeps back for sessions it has just started. Each test gets its own empty state folder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eastern, newWindow, nightShiftWork } from "./cue.mjs";
import { main } from "./queue.mjs";
import { backlog } from "./rules.mjs";
import { readSprintDoc } from "./sprint-doc.mjs";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const OCTOBER_DOC = readFileSync(path.join(FIXTURES, "october-sprint.md"), "utf8");
// The sprint doc as /sprint-start expects it: no dates of its own, and a sprint log.
const DOC_TEXT = OCTOBER_DOC.replace(
  /^\*\*Window \(UTC\):\*\*.*$/m,
  "**Window (UTC):** set by `/sprint-start`.",
).replace("issue `#<n>` (filled in at setup)", "issue `#290`");
const CUE = new Date("2026-10-27T23:59:30Z");
const fresh = () => mkdtempSync(path.join(os.tmpdir(), "sprint-state-"));
const run = (argv, opts, stdin) => {
  const r = main(argv, { docText: DOC_TEXT, now: CUE, stdin, ...opts });
  return { code: r.code, json: JSON.parse(r.out) };
};
const later = (h) => new Date(CUE.getTime() + h * 3600000);

test("a window runs from the cue, to the minute, for 38 hours unless told otherwise, shown on the owner's clock", () => {
  assert.deepEqual(newWindow(CUE), { start: "2026-10-27T23:59:00.000Z", end: "2026-10-29T13:59:00.000Z" });
  assert.equal(newWindow(CUE, "12").end, "2026-10-28T11:59:00.000Z");
  for (const bad of [0, 97, "1.5", "soon"]) assert.throws(() => newWindow(CUE, bad), /whole number of hours/);
  assert.equal(eastern(new Date("2026-10-28T00:00:00Z")), "Tue 27 Oct 20:00");
  assert.equal(eastern(new Date("2026-11-02T01:00:00Z")), "Sun 1 Nov 20:00", "after the clocks go back");
});

test("window start opens it on this computer, ids records the scheduled tasks, stop ends it now, and a new one waits for the last archiver", () => {
  const dir = fresh();
  assert.equal(run(["window"], { dir }).json.state, "none");
  assert.equal(run(["window", "start", "--dry-run"], { dir }).json.state, "open");
  assert.equal(run(["window"], { dir }).json.state, "none", "a dry run writes nothing");

  const opened = run(["window", "start"], { dir }).json;
  assert.deepEqual([opened.state, opened.start, opened.end], ["open", "2026-10-27T23:59Z", "2026-10-29T13:59Z"]);
  assert.equal(opened.eastern, "Tue 27 Oct 19:59 to Thu 29 Oct 09:59");
  assert.deepEqual([opened.lanes, opened.log], [["rules", "app", "online", "research"], 290]);
  const again = run(["window", "start", "12"], { dir, now: later(1) });
  assert.equal(again.code, 1, "a second cue doesn't move an open window");
  assert.match(again.json.error, /already open, until 2026-10-29T13:59Z/);

  run(["window", "ids", "--supervisor", "trig_01Sup", "--archiver", "trig_01Arc"], { dir, now: later(1) });
  const ids = run(["window"], { dir, now: later(2) }).json;
  assert.deepEqual([ids.supervisor, ids.archiver], ["trig_01Sup", "trig_01Arc"]);
  assert.equal(run(["window", "ids", "--supervisor", "oops"], { dir, now: later(2) }).code, 2);

  const stopped = run(["window", "stop"], { dir, now: later(3) }).json;
  assert.deepEqual([stopped.state, stopped.end], ["after", "2026-10-28T02:59Z"]);
  assert.equal(run(["window", "stop"], { dir, now: later(4) }).code, 1, "nothing left to stop");
  const early = run(["window", "start"], { dir, now: later(4) });
  assert.equal(early.code, 1, "the last window's sessions may still be running");
  assert.match(early.json.error, /archiver trig_01Arc is still on record/);
  assert.equal(run(["window", "archived"], { dir, now: later(5) }).json.archiver, null, "the archiver is off");
  assert.equal(run(["window", "start"], { dir, now: later(5) }).json.state, "open", "a new cue after a stop");
  assert.equal(run(["window", "archived"], { dir, now: later(6) }).code, 1, "not while the window is open");
});

test("the night shift gets nothing while this computer's window is open, and works again after it", () => {
  const dir = fresh();
  const gh = (args) => {
    const key = args.join(" ");
    if (key.startsWith("issue list --state open"))
      return JSON.stringify([
        { number: 5, title: "[task] R5: x", labels: [{ name: "ready" }], body: "", comments: [] },
      ]);
    if (key.startsWith("issue list --state all")) return JSON.stringify([{ number: 5, title: "[task] R5: x" }]);
    if (args[0] === "api") return "2026-10-27T11:00:00Z\n";
    return "[]";
  };
  const night = (now) => run(["next", "night"], { dir, gh, now, freeMb: 16000, localMinutes: 60 }).json;
  assert.equal(night(CUE).mode, "build", "no window yet");
  run(["window", "start"], { dir });
  assert.equal(night(later(2)), null, "inside the window");
  assert.equal(night(later(39)).mode, "build", "after it");
});

test("the supervisor's triggers are found by recorded id, the newest per title, never from RemoteTrigger's list", () => {
  const dir = fresh();
  assert.equal(run(["started", "TD lane: rules", "trig_01Old"], { dir }).code, 1, "no window, no sessions");
  run(["window", "start"], { dir });
  run(["started", "TD lane: rules", "trig_01First"], { dir, now: later(1) });
  run(["started", "TD plan: app", "trig_01Plan"], { dir, now: later(1) });
  run(["started", "TD lane: rules", "trig_01Second"], { dir, now: later(2) });
  assert.deepEqual(run(["sessions"], { dir, now: later(3) }).json, {
    "TD lane: rules": "trig_01Second",
    "TD plan: rules": null,
    "TD lane: app": null,
    "TD plan: app": "trig_01Plan",
    "TD lane: online": null,
    "TD plan: online": null,
    "TD lane: research": null,
    "TD plan: research": null,
  });
  assert.deepEqual(
    run(["sessions", "--all"], { dir, now: later(3) }).json.map((t) => t.id),
    ["trig_01Second", "trig_01First", "trig_01Plan"],
    "the archiver's list, newest first",
  );
  assert.match(run(["started", "TD lane: everything", "trig_01X"], { dir }).json.error, /not a sprint session title/);
  assert.match(run(["started", "TD lane: rules", "42"], { dir }).json.error, /not a trigger id/);
});

test("night-shift names the night shift's tasks in flight; lane tasks are the sprint's own", () => {
  const issue = (number, labels) => ({ number, title: `[task] X${number}: x`, state: "OPEN", labels });
  const S = {
    issues: [issue(7, ["ready", "in-progress"]), issue(8, ["lane:app", "in-progress"]), issue(9, ["ready"])],
  };
  assert.deepEqual(nightShiftWork(S), {
    active: true,
    building: [{ number: 7, title: "[task] X7: x" }],
    reason: "the night shift is building #7; it stops after that task",
  });
  assert.equal(nightShiftWork({ issues: [issue(8, ["lane:app", "in-progress"])] }).active, false);
});

test("with no window, or after one, a plan session is on the planning day and aims for six", () => {
  const doc = readSprintDoc(DOC_TEXT);
  const S = { now: CUE, issues: [] };
  assert.equal(backlog(S, doc, "rules").target, 6);
  const october = readSprintDoc(OCTOBER_DOC);
  assert.equal(backlog({ ...S, now: new Date("2026-10-23T12:00:00Z") }, october, "rules").target, 6, "after");
  assert.equal(backlog({ ...S, now: new Date("2026-10-21T12:00:00Z") }, october, "rules").target, 3, "during");
});

test("has-work keeps 1.5 GB back for each session the supervisor already started this run", () => {
  const ask = (started, freeMb) =>
    run(
      [
        "has-work",
        "TD lane: online",
        "--fixture",
        path.join(FIXTURES, "october.jsonl"),
        "--at",
        "2026-10-22T09:00:00Z",
      ].concat(["--free-mb", String(freeMb), "--started", String(started)]),
      { docText: OCTOBER_DOC },
    ).json;
  assert.equal(ask(0, 6000).start, true);
  assert.deepEqual(ask(2, 6000), {
    start: false,
    reason: "2928 MB free, under the 4096 MB floor, counting 1536 MB for each of the 2 sessions started this run",
  });
});

test("resume reads a run's usage-limit error from stdin without loading GitHub, and names the restart time", () => {
  const gh = () => assert.fail("resume asks GitHub nothing");
  const text = "You've hit your session limit · resets 12am (America/New_York)";
  const log = `${text}\nQuotes " and ' and $(date) in a log stay text`;
  const at = { gh, now: new Date("2026-10-21T03:00:00Z") };
  const r = run(["resume", "-", "--last-event", "2026-10-21T02:11:00Z"], at, () => log);
  assert.deepEqual(r.json, {
    start: false,
    after: "2026-10-21T04:00Z",
    restartAt: "2026-10-21T04:02Z",
    reason: "usage limit; resets 2026-10-21T04:00Z",
  });
  assert.equal(run(["resume", "-"], { gh }, () => text).code, 2, "no last event");
  assert.equal(run(["resume", text, "--last-event", "2026-10-21T02:11:00Z"], at).code, 2, "the log goes on stdin");
});

test("window start records the environment /sprint-start found, and env prints it ahead of any doc line", () => {
  const dir = fresh();
  assert.equal(run(["env"], { dir }).code, 2, "nothing on record yet");
  assert.equal(run(["window", "start", "--environment", "env 1"], { dir }).code, 2, "not an environment id");
  run(["window", "start", "12", "--environment", "env_01Found"], { dir });
  assert.deepEqual(run(["env"], { dir }).json, { environment_id: "env_01Found" });
  const withLine = DOC_TEXT.replace("## Machinery\n", "## Machinery\n\n- **Environment:** `env_01Old` (old)\n");
  const r = main(["env"], { docText: withLine, now: CUE, dir });
  assert.deepEqual(JSON.parse(r.out), { environment_id: "env_01Found" }, "the window's own beats a stale doc line");
});

test("window stop records that /sprint-stop ended it; a window that runs out, or a new one, does not", () => {
  const dir = fresh();
  run(["window", "start", "2"], { dir });
  assert.equal(run(["window"], { dir }).json.stoppedBy, null);
  assert.equal(run(["window"], { dir, now: later(3) }).json.stoppedBy, null, "ran out on its own");
  run(["window", "start", "4"], { dir, now: later(3) });
  const stopped = run(["window", "stop"], { dir, now: later(4) }).json;
  assert.deepEqual([stopped.state, stopped.stoppedBy], ["after", "sprint-stop"]);
  assert.equal(run(["window"], { dir, now: later(9) }).json.stoppedBy, "sprint-stop");
  assert.equal(run(["window", "start"], { dir, now: later(9) }).json.stoppedBy, null, "a new window starts clean");
});
