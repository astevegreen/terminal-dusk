// The six-region map's drawing (L2, #465): every country inside its region and the map, nothing overlapping, the
// regions roughly where they are in the world, and every marker's name short enough to fit.
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { byCodeUnit } from "../../test/order.ts";
import { SHORT_MAX, covers, shortName } from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";
import { expectInside, expectNoOverlap } from "./test/layoutChecks.ts";

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
    for (const middle of ["europe", "middle-east-north-africa", "sub-saharan-africa"]) {
      expect(right("americas")).toBeLessThan(r[middle]!.x);
      for (const east of ["eastern-europe-central-asia", "east-south-asia"])
        expect(right(middle)).toBeLessThan(r[east]!.x);
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
