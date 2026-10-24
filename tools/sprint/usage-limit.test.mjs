// Tests for usage-limit.mjs: when a session that stopped on a usage limit may start again. The messages are
// the ones October's sessions ended on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeAfter } from "./usage-limit.mjs";

const SESSION = (time) =>
  `You've hit your session limit · resets ${time} (America/New_York) (error type rate_limit, HTTP 429, request id)`;
const at = (s) => new Date(s);

test("21 Oct: a session limit at 02:11 UTC that resets 12am New York waits until 04:00 UTC, restarting at 04:02", () => {
  const last = "2026-10-21T02:11:00Z";
  assert.deepEqual(resumeAfter(SESSION("12am"), { lastEventAt: last, now: at("2026-10-21T03:02:00Z") }), {
    start: false,
    after: "2026-10-21T04:00Z",
    restartAt: "2026-10-21T04:02Z",
    reason: "usage limit; resets 2026-10-21T04:00Z",
  });
  const later = resumeAfter(SESSION("12am"), { lastEventAt: last, now: at("2026-10-21T04:02:00Z") });
  assert.equal(later.start, true);
  assert.match(later.reason, /which has passed$/);
});

test("a reset with minutes, later the same New York day", () => {
  const r = resumeAfter(SESSION("4:30pm"), { lastEventAt: "2026-10-22T19:00:00Z", now: at("2026-10-22T19:05:00Z") });
  assert.equal(r.after, "2026-10-22T20:30Z");
  assert.equal(r.restartAt, "2026-10-22T20:32Z", "2 minutes past the reset");
  assert.equal(r.start, false);
});

test("daylight saving ends on 1 November: the reset is read in whichever offset New York has then", () => {
  // 19:00 EDT on 31 Oct; 3am on 1 Nov is after the clocks go back, so UTC-5.
  assert.equal(resumeAfter(SESSION("3am"), { lastEventAt: "2026-10-31T23:00:00Z" }).after, "2026-11-01T08:00Z");
  assert.equal(resumeAfter(SESSION("1:30pm"), { lastEventAt: "2026-11-02T15:00:00Z" }).after, "2026-11-02T18:30Z");
});

test("a weekly limit names its date", () => {
  const weekly = "You've hit your weekly limit · resets Oct 28, 9am (America/New_York)";
  assert.equal(resumeAfter(weekly, { lastEventAt: "2026-10-26T12:00:00Z" }).after, "2026-10-28T13:00Z");
});

test("no reset time, no zone or a zone no one knows: wait an hour after the last event", () => {
  const last = "2026-10-21T02:11:00Z";
  for (const text of [
    "API Error: usage limit reached",
    "You've hit your session limit · resets 4:30pm",
    "You've hit your session limit · resets 4:30pm (Mars/Olympus_Mons)",
  ]) {
    const r = resumeAfter(text, { lastEventAt: last, now: at("2026-10-21T02:40:00Z") });
    assert.equal(r.start, false, text);
    assert.equal(r.after, "2026-10-21T03:11Z", text);
    assert.match(r.reason, /an hour after its last event/, text);
  }
});

test("a run that ended any other way doesn't wait, and a missing or bad last-event time is an error", () => {
  assert.deepEqual(resumeAfter("Done. Merged #251.", { lastEventAt: "2026-10-21T02:11:00Z" }), {
    start: true,
    reason: "the run did not stop on a usage limit",
  });
  assert.throws(() => resumeAfter(SESSION("12am"), { lastEventAt: "yesterday" }), /is not a time/);
  assert.throws(() => resumeAfter(SESSION("12am"), {}), /is not a time/);
});
