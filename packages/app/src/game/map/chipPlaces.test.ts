// Where each region's standings chip sits (L8, #488): under the region's name, inside the region, clear of every
// country marker, home box and true-place dot. The chip is drawn in layout units inside the map's one wrapper, so
// clear here means clear at every zoom.
import { SIDES } from "@terminal-dusk/engine";
import type { Country, GameMap } from "@terminal-dusk/engine";
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { testModeConfig } from "../../testMode/fixture.ts";
import { autoLayout } from "./autoLayout.ts";
import { chipBox, chipPlaces } from "./chipPlaces.ts";
import { CHIP, LABEL_BAND, MARKER, contains, grow, markerArea, markerBox, overlaps } from "./layout.ts";
import type { MapLayout, Rect } from "./layout.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";

const country = (id: string, region: string): Country => ({ id, name: id, region, stability: 1, neighbours: [] });

/** A made-up map with scoring: `counts[i]` countries in region i. */
function madeUp(counts: number[]): GameMap {
  const regions = counts.map((_, i) => ({ id: `r${i}`, name: `Region ${i}` }));
  const countries = counts.flatMap((n, i) => Array.from({ length: n }, (_, j) => country(`r${i}c${j}`, `r${i}`)));
  const scoring = {
    track: { end: 20, start: 0 },
    regions: regions.map((r) => ({ region: r.id, present: 1, ahead: 2, all: 3 })),
  };
  return { regions, countries, closingOrder: [], battlegrounds: [], homeBox: { lio: [], sae: [] }, scoring };
}

const sixMap = sixRegionMapConfig().setup.map!;
const testMap = testModeConfig().setup.map!;

/** Everything on the map a chip must leave in view: markers, home boxes and the dots at true places. */
function obstacles(layout: MapLayout, map: GameMap): [string, Rect][] {
  return [
    ...map.countries.map((c): [string, Rect] => [c.id, markerBox(layout.countries[c.id]!)]),
    ...SIDES.map((s): [string, Rect] => [`${s} home`, markerBox(layout.homes[s])]),
    ...Object.entries(layout.places ?? {}).map(([id, p]): [string, Rect] => [
      `${id} place`,
      grow({ x: p.x, y: p.y, w: 0, h: 0 }, 5),
    ]),
  ];
}

function expectClear(layout: MapLayout, map: GameMap): void {
  const places = chipPlaces(layout);
  for (const region of map.regions) {
    const at = places[region.id];
    expect(at, `${region.id} has a chip`).toBeDefined();
    expect(Number.isInteger(at!.x) && Number.isInteger(at!.y), `${region.id} in whole numbers`).toBe(true);
    const chip = chipBox(at!);
    expect(contains(markerArea(layout.regions[region.id]!), chip), `${region.id}'s chip under its name`).toBe(true);
    for (const [name, box] of obstacles(layout, map))
      expect(overlaps(chip, box), `${region.id}'s chip over ${name}`).toBe(false);
  }
}

describe("chipPlaces", () => {
  it("is CHIP's size, wide enough for a side's longest line", () => {
    expect(chipBox({ x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: CHIP.w, h: CHIP.h });
  });

  it("puts a chip in every region of the six-region map, under its name and clear of everything", () => {
    expectClear(SIX_REGION_LAYOUT, sixMap);
  });

  it("puts each six-region chip close under its region's name, not far down the region", () => {
    const places = chipPlaces(SIX_REGION_LAYOUT);
    for (const region of sixMap.regions) {
      const rect = SIX_REGION_LAYOUT.regions[region.id]!;
      expect(places[region.id]!.y - (rect.y + LABEL_BAND), region.id).toBeLessThanOrEqual(MARKER.h + 8);
    }
  });

  for (const [name, map] of [
    ["the test map", testMap],
    ["seven uneven regions, one empty", madeUp([1, 5, 0, 12, 2, 3, 7])],
    ["one region of 30 countries", madeUp([30])],
  ] as const) {
    it(`gives autoLayout room for a chip right under each name on ${name}`, () => {
      const layout = autoLayout(map);
      expectClear(layout, map);
      for (const region of map.regions) {
        const rect = layout.regions[region.id]!;
        expect(chipPlaces(layout)[region.id]!.y - (rect.y + LABEL_BAND), region.id).toBeLessThanOrEqual(4);
      }
    });
  }

  it("leaves autoLayout as it was on a map without scoring: its countries start right under the name", () => {
    const plain: GameMap = { ...madeUp([2, 3]) };
    delete plain.scoring;
    const layout = autoLayout(plain);
    expect(layout.countries["r0c0"]!.y).toBe(layout.regions["r0"]!.y + LABEL_BAND + MARKER.h / 2);
  });

  it("works each layout out once", () => {
    expect(chipPlaces(SIX_REGION_LAYOUT)).toBe(chipPlaces(SIX_REGION_LAYOUT));
  });
});
