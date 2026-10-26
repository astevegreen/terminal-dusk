// The test map as the host hands it to the app (issue #366): R14's TEST_MAP_SCENARIO through content's scenarioSetup.
import { TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import { describe, expect, it } from "vitest";
import { firstDeckConfig, firstDeckTestMap } from "./firstDeck.ts";

describe("firstDeckTestMap", () => {
  it("returns the test map, starting influence included, equal to the scenario's map", () => {
    const map = firstDeckTestMap();
    expect(map).toEqual(TEST_MAP_SCENARIO.map);
    expect(map.countries).toHaveLength(12);
    expect(map.startingInfluence.length).toBeGreaterThan(0);
  });
  it("returns separate objects from two calls, sharing no array or object with each other or the scenario", () => {
    const a = firstDeckTestMap();
    const b = firstDeckTestMap();
    expect(a).not.toBe(b);
    expect(a.countries).not.toBe(b.countries);
    expect(a.countries[0]).not.toBe(b.countries[0]);
    expect(a.startingInfluence).not.toBe(b.startingInfluence);
    expect(a.countries).not.toBe(TEST_MAP_SCENARIO.map?.countries);
    a.countries[0]!.stability = 99;
    expect(b.countries[0]!.stability).not.toBe(99);
    expect(TEST_MAP_SCENARIO.map?.countries[0]?.stability).not.toBe(99);
  });
  it("leaves the first-deck game (vs AI and online) without a map", () => {
    expect(firstDeckConfig().setup.map).toBeUndefined();
  });
});
