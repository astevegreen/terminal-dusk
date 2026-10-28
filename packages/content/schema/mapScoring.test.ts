// A scenario map's scoring (R21, #437): the score track and each region's amounts are scenario data, refused at their
// path when the engine's createGame would refuse them.
import { describe, expect, it } from "vitest";
import raw from "../scenarios/test-map.json" with { type: "json" };
import { scenarioSchema } from "./scenario.ts";

type Amounts = { region: string; present: number; ahead: number; all: number };
type Scoring = { track: { end: number; start: number }; regions: Amounts[] };
type Data = { map: { scoring?: Scoring; [key: string]: unknown }; [key: string]: unknown };

/** The paths of every problem the scenario schema finds after `change` edits a fresh copy of the test-map scenario. */
const paths = (change: (s: Data) => void): unknown[][] => {
  const s = JSON.parse(JSON.stringify(raw)) as Data;
  change(s);
  const r = scenarioSchema.safeParse(s);
  return r.success ? [] : r.error.issues.map((i) => [...i.path]);
};
const scoring = (s: Data): Scoring => s.map.scoring!;
const n = raw.map.scoring.regions.length;

describe("a scenario map's scoring", () => {
  it("accepts the test-map scenario's scoring (so each refusal below is caused by its own change)", () => {
    expect(paths(() => {})).toEqual([]);
  });
  it("is optional: a map without scoring is accepted", () => {
    expect(paths((s) => delete s.map.scoring)).toEqual([]);
  });
  it("refuses a track end that is not a whole number of 1 or more", () => {
    for (const end of [0, -5, 2.5]) {
      expect(paths((s) => (scoring(s).track.end = end))).toContainEqual(["map", "scoring", "track", "end"]);
    }
  });
  it("refuses a start that is not strictly between the two ends, at the start", () => {
    for (const start of [20, -20, 21]) {
      expect(paths((s) => (scoring(s).track.start = start))).toEqual([["map", "scoring", "track", "start"]]);
    }
    expect(paths((s) => (scoring(s).track.start = 2.5))).toEqual([["map", "scoring", "track", "start"]]);
    expect(paths((s) => (scoring(s).track.start = -19))).toEqual([]);
  });
  it("refuses an amount that is not a whole number of 0 or more, at that amount", () => {
    expect(paths((s) => (scoring(s).regions[1]!.ahead = -1))).toEqual([["map", "scoring", "regions", 1, "ahead"]]);
    expect(paths((s) => (scoring(s).regions[2]!.all = 1.5))).toEqual([["map", "scoring", "regions", 2, "all"]]);
    expect(paths((s) => (scoring(s).regions[0]!.present = 0))).toEqual([]);
  });
  it("does not check the order of the three amounts: they are the scenario's numbers", () => {
    expect(paths((s) => Object.assign(scoring(s).regions[0]!, { present: 5, ahead: 1, all: 0 }))).toEqual([]);
  });
  it("refuses an unknown region, at that region, and the region it replaced as not scored", () => {
    expect(paths((s) => (scoring(s).regions[0]!.region = "nowhere"))).toEqual([
      ["map", "scoring", "regions", 0, "region"],
      ["map", "scoring", "regions"],
    ]);
  });
  it("refuses a region listed twice, at the second", () => {
    const first = raw.map.scoring.regions[0]!;
    expect(paths((s) => scoring(s).regions.push({ ...first }))).toEqual([["map", "scoring", "regions", n, "region"]]);
  });
  it("refuses a list that leaves a region out", () => {
    expect(paths((s) => scoring(s).regions.pop())).toEqual([["map", "scoring", "regions"]]);
  });
  it("refuses other fields at every level", () => {
    expect(paths((s) => Object.assign(scoring(s), { tieBreak: 1 }))).toEqual([["map", "scoring"]]);
    expect(paths((s) => Object.assign(scoring(s).track, { size: 1 }))).toEqual([["map", "scoring", "track"]]);
    expect(paths((s) => Object.assign(scoring(s).regions[0]!, { bonus: 1 }))).toEqual([
      ["map", "scoring", "regions", 0],
    ]);
  });
});
