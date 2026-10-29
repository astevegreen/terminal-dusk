// R25 (#462): createGame checks the map's tech race data (techRace.ts, techRaceError), and card data can't mark a
// spendPoints step as a play for points, which only the engine's own plays may (turn.ts).
import { describe, expect, it } from "vitest";
import { rulesetError } from "./cardChecks.ts";
import { createGame } from "./createGame.ts";
import { ruleset, sideCard, startGame, withCards } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import { TECH_RACE } from "./test/techRace.ts";
import type { EngineError, MapTechRace, Step } from "./types.ts";

const refusal = (techRace: unknown): EngineError | null => {
  const r = createGame(ruleset, mapSetup({ ...testMap(), techRace: techRace as MapTechRace }), "seed-1");
  return r.ok ? null : r.error;
};

describe("the map's tech race", () => {
  it("is accepted with the doc's track (so each refusal below has its own cause)", () => {
    expect(refusal(TECH_RACE)).toBeNull();
  });

  it("is optional: a game whose map has none has no tech race in its state", () => {
    expect(refusal(undefined)).toBeNull();
    expect("techRace" in startGame(2, 1, ruleset, mapSetup()).public).toBe(false);
  });

  it("is copied into the public map, and the marker starts at parity", () => {
    const pub = startGame(2, 1, ruleset, mapSetup({ ...testMap(), techRace: TECH_RACE })).public;
    expect(pub.map!.techRace).toEqual(TECH_RACE);
    expect(pub.techRace).toEqual({ marker: 0, attempted: [], reached: [], bonus: [] });
  });

  it("refuses a track with no steps", () => {
    expect(refusal({ ...TECH_RACE, steps: [], escalateAt: 1 })?.code).toBe("invalidSetup");
  });

  it("refuses a step whose cost is not a whole number, 1 or more, or whose name is empty", () => {
    const step = (change: Record<string, unknown>) => ({
      ...TECH_RACE,
      steps: TECH_RACE.steps.map((s, i) => (i === 1 ? { ...s, ...change } : s)),
    });
    expect(refusal(step({ cost: 0 }))?.message).toMatch(/cost/);
    expect(refusal(step({ cost: 1.5 }))?.message).toMatch(/cost/);
    expect(refusal(step({ name: "" }))?.message).toMatch(/name/);
  });

  it("refuses a success number that is not a whole number, 1 or more", () => {
    expect(refusal({ ...TECH_RACE, success: 0 })?.message).toMatch(/success/);
    expect(refusal({ ...TECH_RACE, success: 2.5 })?.message).toMatch(/success/);
  });

  it("refuses an Escalation step off the track", () => {
    expect(refusal({ ...TECH_RACE, escalateAt: 0 })?.message).toMatch(/escalateAt/);
    expect(refusal({ ...TECH_RACE, escalateAt: 5 })?.message).toMatch(/escalateAt/);
  });

  it("refuses data that is not an object, or steps that are not a list", () => {
    expect(refusal(7)?.code).toBe("invalidSetup");
    expect(refusal({ ...TECH_RACE, steps: "AI" })?.code).toBe("invalidSetup");
  });
});

describe("a card's spendPoints step", () => {
  it("may not mark itself as a play for points, at any depth", () => {
    const flagged = { op: "spendPoints", side: "lio", amount: 2, play: true } as Step;
    expect(rulesetError(withCards(sideCard("l1", 1, [flagged])))?.message).toMatch(/l1/);
    const deep: Step = { op: "if", cond: { op: "yes", var: "x" }, then: [flagged] };
    expect(rulesetError(withCards(sideCard("l1", 1, [deep])))?.code).toBe("invalidRuleset");
  });
});
