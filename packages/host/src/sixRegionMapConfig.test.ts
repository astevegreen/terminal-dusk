// The six-region map game as the host hands it to the app (A14, issue #439): the first deck's config with the
// six-region scenario's map, and nothing else of that scenario.
import { SIX_REGION_MAP_SCENARIO } from "@terminal-dusk/content";
import { describe, expect, it } from "vitest";
import { SIX_REGION_MAP_NOTE, firstDeckConfig, sixRegionMapConfig } from "./firstDeck.ts";

describe("sixRegionMapConfig", () => {
  it("carries the six-region map, starting influence and home boxes included, equal to the scenario's map", () => {
    const { map } = sixRegionMapConfig().setup;
    expect(map).toEqual(SIX_REGION_MAP_SCENARIO.map);
    expect(map?.regions).toHaveLength(6);
    expect(map?.countries).toHaveLength(42);
  });
  it("is otherwise the first-deck config: the same hands, draw pile, turns, plays, hand size and eras", () => {
    expect(sixRegionMapConfig().setup).toEqual({ ...firstDeckConfig().setup, map: SIX_REGION_MAP_SCENARIO.map });
    expect(sixRegionMapConfig().matchId).toBe("six-region-map");
    expect(sixRegionMapConfig().players).toEqual(firstDeckConfig().players);
  });
  it("gives a fresh map each call, sharing nothing with another call or the scenario", () => {
    const a = sixRegionMapConfig().setup.map!;
    const b = sixRegionMapConfig().setup.map!;
    expect(a.countries).not.toBe(b.countries);
    a.countries[0]!.stability = 99;
    expect(b.countries[0]!.stability).not.toBe(99);
    expect(SIX_REGION_MAP_SCENARIO.map?.countries[0]?.stability).not.toBe(99);
  });
  it("has a note that says it is the first deck on the six-region map", () => {
    expect(SIX_REGION_MAP_NOTE).toMatch(/six-region map/);
  });
});
