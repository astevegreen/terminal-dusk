// R21: createGame checks the map's scoring data (scoring.ts, scoringError). The amounts and the track's size are
// scenario data; these checks only make sure they are usable.
import { describe, expect, it } from "vitest";
import { createGame } from "./createGame.ts";
import { mapState } from "./mapChecks.ts";
import { ruleset } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import type { EngineError, MapScoring } from "./types.ts";

const SCORING: MapScoring = {
  track: { end: 10, start: 0 },
  regions: [
    { region: "south", present: 1, ahead: 2, all: 4 },
    { region: "east", present: 2, ahead: 3, all: 6 },
    { region: "north", present: 1, ahead: 3, all: 5 },
  ],
};
const refusal = (scoring: unknown): EngineError | null => {
  const r = createGame(ruleset, mapSetup({ ...testMap(), scoring: scoring as MapScoring }), "seed-1");
  return r.ok ? null : r.error;
};
const withRegion = (i: number, change: Record<string, unknown>): unknown => ({
  ...SCORING,
  regions: SCORING.regions.map((r, j) => (j === i ? { ...r, ...change } : r)),
});

describe("the map's scoring", () => {
  it("is accepted when it names every region once with whole amounts (so each refusal below has its own cause)", () => {
    expect(refusal(SCORING)).toBeNull();
  });
  it("is optional: a map without it is accepted", () => {
    expect(refusal(undefined)).toBeNull();
  });
  it("accepts amounts of 0, in any order of size: the numbers are the scenario's", () => {
    expect(refusal(withRegion(0, { present: 3, ahead: 0, all: 1 }))).toBeNull();
  });
  it("accepts a start at any whole number strictly inside the track", () => {
    expect(refusal({ ...SCORING, track: { end: 10, start: -9 } })).toBeNull();
    expect(refusal({ ...SCORING, track: { end: 1, start: 0 } })).toBeNull();
  });
  it("refuses a track end that is not a whole number of 1 or more", () => {
    for (const end of [0, -3, 2.5, "10", undefined]) {
      expect(refusal({ ...SCORING, track: { end, start: 0 } })).toMatchObject({ message: /track's end/ });
    }
  });
  it("refuses a start at or beyond either end, or not a whole number", () => {
    for (const start of [10, -10, 11, 0.5, undefined]) {
      expect(refusal({ ...SCORING, track: { end: 10, start } })).toMatchObject({ message: /track's start/ });
    }
  });
  it("refuses an unknown region, a region named twice, or a region left out", () => {
    expect(refusal(withRegion(0, { region: "west" }))).toMatchObject({ message: /unknown region west/ });
    expect(refusal(withRegion(0, { region: "east" }))).toMatchObject({ message: /region east twice/ });
    expect(refusal({ ...SCORING, regions: SCORING.regions.slice(1) })).toMatchObject({
      message: /does not name region south/,
    });
  });
  it("refuses an amount that is not a whole number of 0 or more", () => {
    for (const level of ["present", "ahead", "all"]) {
      for (const bad of [-1, 1.5, "2", undefined]) {
        expect(refusal(withRegion(1, { [level]: bad }))).toMatchObject({
          code: "invalidSetup",
          message: new RegExp(`east's ${level} amount`),
        });
      }
    }
  });
  it("refuses, without throwing, scoring that is not { track, regions }", () => {
    for (const bad of [null, "x", 3, {}, { track: SCORING.track }, { track: SCORING.track, regions: [null] }]) {
      expect(refusal(bad)?.code).toBe("invalidSetup");
    }
  });
});

describe("the public map", () => {
  it("carries a fresh copy of the scoring, and none when the setup has none", () => {
    const setupMap = { ...testMap(), startingInfluence: [], scoring: SCORING };
    const { map } = mapState(setupMap);
    expect(map.scoring).toStrictEqual(SCORING);
    expect(map.scoring).not.toBe(SCORING);
    expect(map.scoring!.regions[0]).not.toBe(SCORING.regions[0]);
    expect("scoring" in mapState({ ...testMap(), startingInfluence: [] }).map).toBe(false);
  });
});
