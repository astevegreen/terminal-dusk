// The card schema's lasting steps: modifiers (#89), triggers (#90) and lasting markers (#141), at any depth.
import { describe, expect, it } from "vitest";
import { issuesOf, lioCard, pathsOf, pickCard, yesNo } from "./test/cards.ts";

/** An LIO card whose effect is `effect`. */
const lioWith = (effect: unknown[]) => ({ ...lioCard(), effect });
/** A trigger step, "at the turn's end, run `reaction`", with any of its fields replaced by `fields`. */
const trigger = (fields: object = {}, reaction: unknown[] = [{ op: "marker", label: "m" }]) => ({
  op: "trigger",
  hook: "turnEnd",
  do: reaction,
  duration: { kind: "turnEnd" },
  ...fields,
});
/** The step at the top, in an if's then and else, in a forEach, and in a trigger's reaction. */
const placed = (step: object): unknown[][] => [
  [step],
  [yesNo, { op: "if", cond: { op: "yes", var: "agreed" }, then: [step] }],
  [yesNo, { op: "if", cond: { op: "yes", var: "agreed" }, then: [], else: [step] }],
  [{ op: "forEach", over: ["a"], bind: "x", do: [step] }],
  [trigger({}, [step])],
];

describe("card schema: modifier steps", () => {
  const good = { hook: "opsValue", side: "both", add: -1, min: 1 };
  const modifier = (mod: object, duration: object = { kind: "turnEnd" }) => ({ op: "modifier", mod, duration });

  it("accepts a modifier at any depth: each side, a negative or positive add, a min of 0 or none", () => {
    const steps = [
      modifier(good),
      modifier({ hook: "opsValue", side: "lio", add: 2 }),
      modifier({ hook: "opsValue", side: "sae", add: -2, min: 0 }),
    ];
    for (const step of steps) for (const effect of placed(step)) expect(issuesOf(lioWith(effect))).toEqual([]);
  });

  it.each([
    ["an unknown hook", modifier({ ...good, hook: "coupResult" })],
    ["an add of 0", modifier({ ...good, add: 0 })],
    ["an add that is not whole", modifier({ ...good, add: 1.5 })],
    ["a missing add", modifier({ hook: "opsValue", side: "both" })],
    ["a negative min", modifier({ ...good, min: -1 })],
    ["a min that is not whole", modifier({ ...good, min: 0.5 })],
    ["an unknown duration", modifier(good, { kind: "gameEnd" })],
    ["a side that is not lio, sae or both", modifier({ ...good, side: "neutral" })],
  ])("refuses a modifier with %s, at any depth", (_what, step) => {
    for (const effect of placed(step)) expect(issuesOf(lioWith(effect)).length).toBeGreaterThan(0);
  });
});

describe("card schema: trigger steps", () => {
  it("accepts a trigger at any depth: each hook, holding a yes/no, a modifier or another trigger", () => {
    const opsMod = { op: "modifier", mod: { hook: "opsValue", side: "both", add: 1 }, duration: { kind: "turnEnd" } };
    const steps = [
      trigger(),
      trigger({ hook: "cardPlayed" }, [yesNo, { op: "if", cond: { op: "yes", var: "agreed" }, then: [] }]),
      trigger({}, [opsMod]),
      trigger({}, [trigger({ hook: "cardPlayed" })]),
    ];
    for (const step of steps) for (const effect of placed(step)) expect(issuesOf(lioWith(effect))).toEqual([]);
  });

  it.each([
    ["an unknown hook", trigger({ hook: "coupResolved" })],
    ["an empty do", trigger({}, [])],
    ["a missing do", trigger({ do: undefined })],
    ["an unknown duration", trigger({ duration: { kind: "gameEnd" } })],
    ["a card choice in its do", trigger({}, [pickCard])],
    ["an unknown field", trigger({ filter: {} })],
  ])("refuses a trigger with %s, at any depth", (_what, step) => {
    for (const effect of placed(step)) expect(issuesOf(lioWith(effect)).length).toBeGreaterThan(0);
  });

  it("accepts a filtered trigger, a once trigger, and both together, at any depth (#189)", () => {
    const steps = [
      trigger({ hook: "cardPlayed", filter: { op: "playedBy", side: "sae" } }),
      trigger({ hook: "cardPlayed", filter: { op: "has", marker: "x" } }),
      trigger({ filter: { op: "has", marker: "x" } }),
      trigger({ hook: "cardPlayed", once: true }),
      trigger({ hook: "cardPlayed", once: true, filter: { op: "playedBy", side: "lio" } }),
    ];
    for (const step of steps) for (const effect of placed(step)) expect(issuesOf(lioWith(effect))).toEqual([]);
  });

  it.each([
    ["a filter of yes", trigger({ hook: "cardPlayed", filter: { op: "yes", var: "agreed" } })],
    ["a filter of atLeast", trigger({ hook: "cardPlayed", filter: { op: "atLeast", var: "n", value: 1 } })],
    ["playedBy on a turnEnd trigger", trigger({ filter: { op: "playedBy", side: "lio" } })],
    ["once: false", trigger({ hook: "cardPlayed", once: false })],
    ["once on a turnEnd trigger", trigger({ once: true })],
    ["an extra field in the filter", trigger({ hook: "cardPlayed", filter: { op: "has", marker: "x", side: "lio" } })],
  ])("refuses a trigger with %s, at any depth (#189)", (_what, step) => {
    for (const effect of placed(step)) expect(issuesOf(lioWith(effect)).length).toBeGreaterThan(0);
  });

  it("accepts a contingency draw from the rival's deck inside a trigger (owner, 19 Oct)", () => {
    const effect = [trigger({}, [{ op: "drawContingency", side: "sae" }])];
    expect(pathsOf(lioWith(effect))).toEqual([]);
  });

  it("refuses a neutral card's contingency draw inside a trigger, at its path", () => {
    const effect = [trigger({}, [{ op: "drawContingency", side: "sae" }])];
    expect(pathsOf({ ...lioCard(), affiliation: "neutral", effect })).toEqual([["effect", 0, "do", 0, "side"]]);
  });
});

describe("card schema: lasting markers and has conditions (#141)", () => {
  const has = (marker: unknown) => ({ op: "if", cond: { op: "has", marker }, then: [], else: [] });

  it("accepts lasting: true on a marker, with or without a var, and a has condition, at any depth", () => {
    const steps = [
      { op: "marker", label: "x", lasting: true },
      { op: "marker", label: "x", var: "agreed", lasting: true },
      has("x"),
    ];
    for (const step of steps) for (const effect of placed(step)) expect(issuesOf(lioWith(effect))).toEqual([]);
  });

  it.each([
    ["lasting: false", { op: "marker", label: "x", lasting: false }],
    ["a lasting that is a string", { op: "marker", label: "x", lasting: "yes" }],
    ["a lasting that is a number", { op: "marker", label: "x", lasting: 1 }],
    ["a lasting marker with an empty label", { op: "marker", label: "", lasting: true }],
    ["a has with an empty marker", has("")],
    ["a has whose marker is not a string", has(7)],
    ["a has with no marker", { op: "if", cond: { op: "has" }, then: [] }],
  ])("refuses %s, at any depth", (_what, step) => {
    for (const effect of placed(step)) expect(issuesOf(lioWith(effect)).length).toBeGreaterThan(0);
  });

  it("still accepts a plain marker with an empty label, as before", () => {
    expect(issuesOf(lioWith([{ op: "marker", label: "" }]))).toEqual([]);
  });
});

describe("card schema: playedBy conditions (#169)", () => {
  const ifOn = (cond: object) => ({ op: "if", cond, then: [], else: [] });

  it.each(["lio", "sae"])("accepts playedBy %s, at any depth", (side) => {
    for (const effect of placed(ifOn({ op: "playedBy", side }))) expect(issuesOf(lioWith(effect))).toEqual([]);
  });

  it.each([
    ["a side of both", { op: "playedBy", side: "both" }],
    ["a side of player", { op: "playedBy", side: "player" }],
    ["a side of neutral", { op: "playedBy", side: "neutral" }],
    ["a missing side", { op: "playedBy" }],
    ["a var", { op: "playedBy", side: "lio", var: "agreed" }],
    ["another extra key", { op: "playedBy", side: "lio", value: 1 }],
  ])("refuses a playedBy with %s, at any depth", (_what, cond) => {
    for (const effect of placed(ifOn(cond))) expect(issuesOf(lioWith(effect)).length).toBeGreaterThan(0);
  });
});
