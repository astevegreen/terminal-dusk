// A scenario map's tech race track (R25, #462): its steps, success number and Escalation step are scenario data,
// refused at their path when the engine's createGame would refuse them.
import { describe, expect, it } from "vitest";
import raw from "../scenarios/six-region-map.json" with { type: "json" };
import { scenarioSchema } from "./scenario.ts";

type Race = { steps: { name: string; cost: number }[]; success: number; escalateAt: number };
type Data = { map: { techRace?: Race; [key: string]: unknown }; [key: string]: unknown };

/** The paths of every problem the scenario schema finds after `change` edits a fresh copy of the six-region scenario. */
const paths = (change: (race: Race, s: Data) => void): unknown[][] => {
  const s = JSON.parse(JSON.stringify(raw)) as Data;
  change(s.map.techRace!, s);
  const r = scenarioSchema.safeParse(s);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};

describe("a scenario map's tech race", () => {
  it("accepts the six-region scenario's track (so each refusal below is caused by its own change)", () => {
    expect(paths(() => {})).toEqual([]);
  });
  it("is optional: a map without a tech race is accepted", () => {
    expect(paths((_, s) => delete s.map.techRace)).toEqual([]);
  });
  it("refuses a track with no steps", () => {
    expect(paths((race) => (race.steps = []))).toContainEqual(["map", "techRace", "steps"]);
  });
  it("refuses a step cost that is not a whole number of 1 or more, or an empty name, at that step", () => {
    for (const cost of [0, 1.5]) {
      expect(paths((race) => (race.steps[1]!.cost = cost))).toEqual([["map", "techRace", "steps", 1, "cost"]]);
    }
    expect(paths((race) => (race.steps[2]!.name = ""))).toEqual([["map", "techRace", "steps", 2, "name"]]);
  });
  it("refuses a success number that is not a whole number of 1 or more", () => {
    for (const success of [0, 2.5]) {
      expect(paths((race) => (race.success = success))).toEqual([["map", "techRace", "success"]]);
    }
  });
  it("refuses an Escalation step off the track", () => {
    for (const escalateAt of [0, 5]) {
      expect(paths((race) => (race.escalateAt = escalateAt))).toEqual([["map", "techRace", "escalateAt"]]);
    }
    expect(paths((race) => (race.escalateAt = 4))).toEqual([]);
  });
  it("refuses a field the track does not have", () => {
    expect(paths((race) => Object.assign(race, { start: 0 }))).toEqual([["map", "techRace"]]);
  });
});
