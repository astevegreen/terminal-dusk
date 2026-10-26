// The online game screen's words as tables: time left before a deadline, the extra-deadline note, whose turn.
import { describe, expect, it } from "vitest";
import type { Frame } from "@terminal-dusk/host";
import type { OnlineDeadline } from "./matchClock.ts";
import { deadlineText, timeLeft, turnText } from "./gameText.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("timeLeft: how long the waiting side has, from t = at - now", () => {
  const table: [string, number, string][] = [
    ["exactly 24 hours is one day", DAY, "1 day left"],
    ["one day and one hour, both singular", DAY + HOUR, "1 day 1 hour left"],
    ["days and hours, both plural", 2 * DAY + 4 * HOUR, "2 days 4 hours left"],
    ["no hours over whole days leaves the hours out", 2 * DAY, "2 days left"],
    ["days and hours round down", 3 * DAY + 5 * HOUR + 59 * MINUTE, "3 days 5 hours left"],
    ["just under a day is hours", DAY - 1, "23 hours left"],
    ["exactly one hour is singular", HOUR, "1 hour left"],
    ["hours round down", 2 * HOUR + 59 * MINUTE, "2 hours left"],
    ["just under an hour", HOUR - 1, "less than an hour left"],
    ["one millisecond", 1, "less than an hour left"],
    ["exactly 0 is time up", 0, "time is up"],
    ["below 0 is time up", -5 * HOUR, "time is up"],
  ];
  for (const [name, t, text] of table)
    it(`${name}: ${t} ms reads "${text}"`, () => {
      expect(timeLeft(t)).toBe(text);
    });
});

describe("deadlineText: the extra deadline still to come", () => {
  const at = (t: number, rule: OnlineDeadline["rule"], graceLeft: boolean): OnlineDeadline => ({
    side: "lio",
    at: 1_000_000 + t,
    rule,
    days: 3,
    graceLeft,
    now: 1_000_000,
  });
  it("graceThenLoss with grace left adds ', then one extra deadline' after a time left", () => {
    expect(deadlineText(at(2 * DAY + 4 * HOUR, "graceThenLoss", true))).toBe(
      "2 days 4 hours left, then one extra deadline",
    );
    expect(deadlineText(at(HOUR - 1, "graceThenLoss", true))).toBe("less than an hour left, then one extra deadline");
  });
  it("adds nothing once the extension is used, or under lossOnTime", () => {
    expect(deadlineText(at(DAY, "graceThenLoss", false))).toBe("1 day left");
    expect(deadlineText(at(DAY, "lossOnTime", false))).toBe("1 day left");
  });
  it("adds nothing to time is up, at 0 and below", () => {
    expect(deadlineText(at(0, "graceThenLoss", true))).toBe("time is up");
    expect(deadlineText(at(-1, "graceThenLoss", true))).toBe("time is up");
  });
});

/** A frame with just what turnText reads: the viewer, the pending sides and the status. */
const frameWith = (viewer: Frame["viewer"], pending: ("lio" | "sae")[], status: unknown): Frame =>
  ({ viewer, view: { public: { pending: pending.map((side) => ({ side })), status } } }) as unknown as Frame;
const ACTIVE = { kind: "active" };

describe("turnText", () => {
  it("says Your move, Waiting for the rival's side, and Loading the game", () => {
    expect(turnText({ turn: "mine", frame: frameWith("lio", ["lio"], ACTIVE) })).toBe("Your move");
    expect(turnText({ turn: "rival", frame: frameWith("lio", ["sae"], ACTIVE) })).toBe("Waiting for SAE");
    expect(turnText({ turn: "rival", frame: frameWith("sae", ["lio"], ACTIVE) })).toBe("Waiting for LIO");
    expect(turnText({ turn: "loading", frame: null })).toBe("Loading the game");
  });
  it("says You won, You lost or Draw once the game is over", () => {
    const over = (winner: string | null) => ({ kind: "over", winner, reason: "x" });
    expect(turnText({ turn: "over", frame: frameWith("lio", [], over("lio")) })).toBe("You won");
    expect(turnText({ turn: "over", frame: frameWith("lio", [], over("sae")) })).toBe("You lost");
    expect(turnText({ turn: "over", frame: frameWith("sae", [], over(null)) })).toBe("Draw");
  });
});
