// The layout any other map gets (L2, #465): regions in a grid, each country in its own region, nothing overlapping,
// whatever the map; layoutFor picks it whenever the six-region layout does not cover the frame's map.
import type { Country, GameMap } from "@terminal-dusk/engine";
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { testModeConfig } from "../../testMode/fixture.ts";
import { map as fixtureMap } from "../test/mapFixture.ts";
import { autoLayout } from "./autoLayout.ts";
import { covers } from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";
import { expectInside, expectNoOverlap } from "./test/layoutChecks.ts";

const country = (id: string, region: string): Country => ({ id, name: id, region, stability: 1, neighbours: [] });

/** A made-up map: `counts[i]` countries in region i. */
function madeUp(counts: number[]): GameMap {
  const regions = counts.map((_, i) => ({ id: `r${i}`, name: `Region ${i}` }));
  const countries = counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => country(`r${i}c${j}`, `r${i}`)));
  return { regions, countries, closingOrder: [], battlegrounds: [], homeBox: { lio: [], sae: [] } };
}

const MAPS: [string, GameMap][] = [
  ["the test map", testModeConfig().setup.map!],
  ["the two-region fixture map", fixtureMap],
  ["one region of 30 countries", madeUp([30])],
  ["seven uneven regions, one empty", madeUp([1, 5, 0, 12, 2, 3, 7])],
  ["one region with no countries", madeUp([0])],
  ["the six-region map itself", sixRegionMapConfig().setup.map!],
];

describe("autoLayout", () => {
  for (const [name, map] of MAPS) {
    it(`covers ${name}: every country inside its region and the map, in whole numbers`, () => {
      const layout = autoLayout(map);
      expect(covers(layout, map)).toBe(true);
      expectInside(layout, map);
    });
    it(`overlaps nothing on ${name}`, () => {
      expectNoOverlap(autoLayout(map), map);
    });
  }

  it("is the same every time for the same map", () => {
    expect(autoLayout(fixtureMap)).toEqual(autoLayout(fixtureMap));
  });
});

describe("layoutFor", () => {
  it("draws any map the six-region layout does not cover with autoLayout", () => {
    for (const map of [testModeConfig().setup.map!, fixtureMap]) expect(layoutFor(map)).toEqual(autoLayout(map));
  });

  it("falls back to autoLayout when a six-region-like map has a country the six-region layout lacks", () => {
    const six = sixRegionMapConfig().setup.map!;
    const extra: GameMap = { ...six, countries: [...six.countries, country("atlantis", "europe")] };
    expect(layoutFor(extra)).not.toBe(SIX_REGION_LAYOUT);
    expect(layoutFor(extra)).toEqual(autoLayout(extra));
  });
});
