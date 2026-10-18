// The card schema's lasting steps: modifiers (#89) and triggers (#90), at any depth of a card's effect.
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

  it("refuses a contingency draw from the other side's deck inside a trigger, at its path", () => {
    const effect = [trigger({}, [{ op: "drawContingency", side: "sae" }])];
    expect(pathsOf(lioWith(effect))).toEqual([["effect", 0, "do", 0, "side"]]);
  });
});
