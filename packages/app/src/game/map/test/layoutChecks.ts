// Test helper: the checks every map layout must pass, for the six-region layout and for autoLayout on any map.
import { SIDES } from "@terminal-dusk/engine";
import type { GameMap } from "@terminal-dusk/engine";
import { expect } from "vitest";
import { contains, markerArea, markerBox, overlaps, wholeRect } from "../layout.ts";
import type { MapLayout, Rect } from "../layout.ts";

const numbersOf = (layout: MapLayout): number[] => [
  layout.size.w,
  layout.size.h,
  ...Object.values(layout.regions).flatMap((r) => [r.x, r.y, r.w, r.h]),
  ...Object.values(layout.countries).flatMap((p) => [p.x, p.y]),
  ...SIDES.flatMap((s) => [layout.homes[s].x, layout.homes[s].y]),
];

/** Every number is whole; every region and marker is inside the map; every country is under its region's name. */
export function expectInside(layout: MapLayout, map: GameMap): void {
  for (const n of numbersOf(layout)) expect(Number.isInteger(n), `${n} is whole`).toBe(true);
  const whole = wholeRect(layout);
  for (const region of map.regions) expect(contains(whole, layout.regions[region.id]!), region.id).toBe(true);
  for (const country of map.countries) {
    const box = markerBox(layout.countries[country.id]!);
    expect(contains(markerArea(layout.regions[country.region]!), box), `${country.id} in ${country.region}`).toBe(true);
    expect(contains(whole, box), `${country.id} in the map`).toBe(true);
  }
  for (const side of SIDES) expect(contains(whole, markerBox(layout.homes[side])), `${side} home`).toBe(true);
}

/** No two regions overlap, and no two markers (countries and home boxes) overlap. */
export function expectNoOverlap(layout: MapLayout, map: GameMap): void {
  const pairsOf = (named: [string, Rect][]): void => {
    for (const [i, [a, ra]] of named.entries())
      for (const [b, rb] of named.slice(i + 1)) expect(overlaps(ra, rb), `${a} and ${b} overlap`).toBe(false);
  };
  pairsOf(map.regions.map((r) => [r.id, layout.regions[r.id]!]));
  pairsOf([
    ...map.countries.map((c): [string, Rect] => [c.id, markerBox(layout.countries[c.id]!)]),
    ...SIDES.map((s): [string, Rect] => [`${s} home`, markerBox(layout.homes[s])]),
  ]);
}
