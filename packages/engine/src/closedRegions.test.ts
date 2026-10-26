// Which regions are closed to interventions and realignments (R17b, docs/design/map-and-points.md, "Thresholds
// close regions"): none below Escalation 3, then one more region of the map's closing order at 3, 4 and 5.
import { describe, expect, it } from "vitest";
import { closedRegions, createGame, isRegionClosed } from "./index.ts";
import type { PublicState } from "./index.ts";
import { makeSetup, ruleset } from "./test/game.ts";
import { mapSetup } from "./test/map.ts";

/** The public state of a new game with the test map (closing order south, east, north). */
function mapGame(): PublicState {
  const r = createGame(ruleset, mapSetup(), "seed-1");
  if (!r.ok) throw new Error(r.error.message);
  return r.value.state.public;
}

/** The test map game's public state with Escalation set by hand to `level`. */
const at = (level: number): PublicState => ({ ...mapGame(), escalation: level });

describe("closedRegions", () => {
  it("closes no region at Escalation 0, 1 and 2", () => {
    for (const level of [0, 1, 2]) expect(closedRegions(at(level))).toEqual([]);
  });
  it("closes the first region of the closing order at Escalation 3", () => {
    expect(closedRegions(at(3))).toEqual(["south"]);
  });
  it("closes the first two at Escalation 4", () => {
    expect(closedRegions(at(4))).toEqual(["south", "east"]);
  });
  it("closes the first three at Escalation 5", () => {
    expect(closedRegions(at(5))).toEqual(["south", "east", "north"]);
  });
  it("closes the first three at Escalation 6, on a hand-built state (a crisis drops a real game back to 3)", () => {
    expect(closedRegions(at(6))).toEqual(["south", "east", "north"]);
  });
  it("closes nothing at the start of a game with a map (Escalation 2)", () => {
    expect(mapGame().escalation).toBe(2);
    expect(closedRegions(mapGame())).toEqual([]);
  });
  it("gives an empty list in a game without a map", () => {
    const r = createGame(ruleset, makeSetup(), "seed-1");
    if (!r.ok) throw new Error(r.error.message);
    expect(closedRegions(r.value.state.public)).toEqual([]);
  });
  it("returns a fresh list: changing it leaves the state's closing order as it was", () => {
    const pub = at(5);
    closedRegions(pub).pop();
    expect(pub.map!.closingOrder).toEqual(["south", "east", "north"]);
  });
});

describe("isRegionClosed", () => {
  it("agrees with closedRegions for every region at every level from 0 to 6", () => {
    for (let level = 0; level <= 6; level++) {
      const pub = at(level);
      for (const region of pub.map!.regions) {
        expect(isRegionClosed(pub, region.id)).toBe(closedRegions(pub).includes(region.id));
      }
    }
  });
  it("gives false, without throwing, for an unknown region id", () => {
    expect(isRegionClosed(at(5), "west")).toBe(false);
  });
  it("gives false in a game without a map", () => {
    const r = createGame(ruleset, makeSetup(), "seed-1");
    if (!r.ok) throw new Error(r.error.message);
    expect(isRegionClosed(r.value.state.public, "south")).toBe(false);
  });
});
