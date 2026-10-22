// createGame's checks of a trigger's filter and once (#189): badTrigger, and the ruleset check that a has
// names a marker some card sets, which reads a trigger's has filter too.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { EngineErrorCode, Step } from "./index.ts";
import { makeSetup, marker, sideCard, withCards } from "./test/game.ts";

/** A trigger step on `hook` with `fields` added (filter, once), checked by values only. */
const trigger = (hook: string, fields: object): Step =>
  ({ op: "trigger", hook, do: [marker("m")], duration: { kind: "turnEnd" }, ...fields }) as Step;
/** "ok", or the error code createGame returns, with LIO's card l2 given `effect` (and SAE's s2 `other`). */
function outcome(effect: Step[], other: Step[] = []): "ok" | EngineErrorCode {
  const r = createGame(withCards(sideCard("l2", 1, effect), sideCard("s2", 1, other)), makeSetup(), "seed-1");
  return r.ok ? "ok" : r.error.code;
}
const lastingX: Step = { op: "marker", label: "x", lasting: true };

describe("createGame: a trigger's filter and once", () => {
  it.each([
    ["a cardPlayed trigger filtered playedBy lio", trigger("cardPlayed", { filter: { op: "playedBy", side: "lio" } })],
    ["a cardPlayed trigger filtered playedBy sae", trigger("cardPlayed", { filter: { op: "playedBy", side: "sae" } })],
    ["a cardPlayed trigger filtered has x", trigger("cardPlayed", { filter: { op: "has", marker: "x" } })],
    ["a turnEnd trigger filtered has x", trigger("turnEnd", { filter: { op: "has", marker: "x" } })],
    ["a once cardPlayed trigger", trigger("cardPlayed", { once: true })],
    [
      "a once cardPlayed trigger with a filter",
      trigger("cardPlayed", { once: true, filter: { op: "has", marker: "x" } }),
    ],
  ])("accepts %s", (_what, step) => {
    expect(outcome([lastingX, step])).toBe("ok");
  });

  it.each([
    ["a filter of yes", trigger("cardPlayed", { filter: { op: "yes", var: "v" } })],
    ["a filter of atLeast", trigger("cardPlayed", { filter: { op: "atLeast", var: "v", value: 1 } })],
    ["a filter of atMost", trigger("cardPlayed", { filter: { op: "atMost", var: "v", value: 1 } })],
    ["a filter of equals", trigger("cardPlayed", { filter: { op: "equals", var: "v", value: 1 } })],
    ["a filter that is not an object", trigger("cardPlayed", { filter: "has" })],
    ["a has filter with an empty marker", trigger("cardPlayed", { filter: { op: "has", marker: "" } })],
    ["a playedBy filter on a side of both", trigger("cardPlayed", { filter: { op: "playedBy", side: "both" } })],
    ["a playedBy filter on a turnEnd trigger", trigger("turnEnd", { filter: { op: "playedBy", side: "lio" } })],
    ["once: false", trigger("cardPlayed", { once: false })],
    ["once on a turnEnd trigger", trigger("turnEnd", { once: true })],
  ])("refuses %s", (_what, step) => {
    expect(outcome([lastingX, step])).toBe("invalidRuleset");
  });
});

describe("createGame: a trigger's has filter names a marker some card sets", () => {
  const filtered = trigger("cardPlayed", { filter: { op: "has", marker: "x" } });

  it("refuses a ruleset whose only has is a trigger filter on a marker no card sets", () => {
    expect(outcome([filtered])).toBe("invalidRuleset");
  });

  it("accepts it when a card sets that marker lasting", () => {
    expect(outcome([filtered], [lastingX])).toBe("ok");
  });
});
