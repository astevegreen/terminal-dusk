// The six-region map's drawing (L2, #465; real geography since L3, #479): every country inside its region and the
// map, nothing overlapping, the regions roughly where they are in the world, every marker at or near its country's
// true place, joined to it by a leader line when it sits away from it, and every marker's name short enough to fit.
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { byCodeUnit } from "../../test/order.ts";
import {
  LEADER_MAX,
  SHORT_MAX,
  contains,
  covers,
  holds,
  leaderLines,
  markerBox,
  shortName,
  wholeRect,
} from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";
import { expectInside, expectNoOverlap } from "./test/layoutChecks.ts";
import { WORLD_SIZE } from "./world/projection.ts";

const map = sixRegionMapConfig().setup.map!;
const layout = SIX_REGION_LAYOUT;
const sorted = (ids: string[]): string[] => [...ids].sort(byCodeUnit);

describe("the six-region layout", () => {
  it("places exactly the map's 6 regions and 42 countries", () => {
    expect(sorted(Object.keys(layout.regions))).toEqual(sorted(map.regions.map((r) => r.id)));
    expect(sorted(Object.keys(layout.countries))).toEqual(sorted(map.countries.map((c) => c.id)));
    expect(map.countries).toHaveLength(42);
    expect(covers(layout, map)).toBe(true);
  });

  it("puts every country inside its region's rectangle, under its name, and inside the map, in whole numbers", () => {
    expectInside(layout, map);
  });

  it("has no two regions and no two markers (countries and home boxes) overlapping", () => {
    expectNoOverlap(layout, map);
  });

  it("lays the regions out roughly as in the world: the Americas left, Africa and Europe middle, Asia right", () => {
    const r = layout.regions;
    const right = (id: string): number => r[id]!.x + r[id]!.w;
    const centre = (id: string): number => r[id]!.x + r[id]!.w / 2;
    for (const middle of ["europe", "middle-east-north-africa", "sub-saharan-africa"]) {
      expect(right("americas")).toBeLessThan(r[middle]!.x);
      for (const east of ["eastern-europe-central-asia", "east-south-asia"])
        // Real geography puts Iran east of Estonia, so the middle regions' centres, not their edges, lie west.
        expect(centre(middle)).toBeLessThan(centre(east));
    }
    expect(r["europe"]!.y).toBeLessThan(r["middle-east-north-africa"]!.y);
    expect(r["middle-east-north-africa"]!.y).toBeLessThan(r["sub-saharan-africa"]!.y);
    expect(r["eastern-europe-central-asia"]!.y).toBeLessThan(r["east-south-asia"]!.y);
  });

  it("puts countries in rough real-world order inside their regions", () => {
    const at = (id: string) => layout.countries[id]!;
    expect(at("canada").y).toBeLessThan(at("mexico").y);
    expect(at("venezuela").y).toBeLessThan(at("brazil").y);
    expect(at("united-kingdom").x).toBeLessThan(at("poland").x);
    expect(at("finland").y).toBeLessThan(at("greece").y);
    expect(at("libya").x).toBeLessThan(at("iran").x);
    expect(at("ukraine").y).toBeLessThan(at("crimea").y);
    expect(at("estonia").x).toBeLessThan(at("kazakhstan").x);
    expect(at("pakistan").x).toBeLessThan(at("japan").x);
    expect(at("taiwan").y).toBeLessThan(at("australia").y);
  });

  it("is drawn on the world picture's 1960 by 826 units", () => {
    expect(layout.size).toEqual(WORLD_SIZE);
  });

  it("gives every country a true place, in whole units, inside the map", () => {
    const places = layout.places!;
    expect(sorted(Object.keys(places))).toEqual(sorted(map.countries.map((c) => c.id)));
    for (const [id, p] of Object.entries(places)) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y), id).toBe(true);
      expect(holds(wholeRect(layout), p), `${id} in the map`).toBe(true);
    }
  });

  it("puts the true places in real-world order", () => {
    const at = (id: string) => layout.places![id]!;
    expect(at("canada").y).toBeLessThan(at("mexico").y);
    expect(at("united-kingdom").x).toBeLessThan(at("poland").x);
    expect(at("lebanon").y).toBeLessThan(at("israel").y);
    expect(at("ukraine").y).toBeLessThan(at("crimea").y);
    expect(at("north-korea").y).toBeLessThan(at("south-korea").y);
    expect(at("japan").x).toBeGreaterThan(at("south-korea").x);
  });

  it("joins every marker away from its place to that place with a leader line no longer than 180 units", () => {
    const leaders = leaderLines(layout);
    expect(leaders.length).toBeGreaterThan(0);
    for (const c of map.countries) {
      const place = layout.places![c.id]!;
      const marker = layout.countries[c.id]!;
      const leader = leaders.find((l) => l.country === c.id);
      if (holds(markerBox(marker), place)) {
        expect(leader, `${c.id} sits on its place`).toBeUndefined();
        continue;
      }
      expect(leader, `${c.id} has a leader line`).toEqual({ country: c.id, from: marker, to: place });
      expect(Math.hypot(place.x - marker.x, place.y - marker.y), c.id).toBeLessThanOrEqual(LEADER_MAX);
    }
  });

  it("keeps both home boxes inside the map", () => {
    for (const side of ["lio", "sae"] as const)
      expect(contains(wholeRect(layout), markerBox(layout.homes[side])), side).toBe(true);
  });

  it("gives every country a marker name of at most 9 letters, its own name when short enough", () => {
    for (const c of map.countries) {
      const shown = layout.short[c.id] ?? shortName(c.name);
      expect(shown.length, c.id).toBeLessThanOrEqual(SHORT_MAX);
      if (c.name.length <= SHORT_MAX) expect(shown).toBe(c.name);
    }
    expect(layout.short["united-kingdom"]).toBe("UK");
  });

  it("is the layout layoutFor picks for the six-region map", () => {
    expect(layoutFor(map)).toBe(SIX_REGION_LAYOUT);
  });
});
