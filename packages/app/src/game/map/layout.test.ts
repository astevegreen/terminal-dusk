// The layout helpers (L2, #465): neighbour lines once per pair, short names, and the rectangle tests.
import type { Country, GameMap } from "@terminal-dusk/engine";
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { byCodeUnit } from "../../test/order.ts";
import { contains, grow, markerBox, neighbourPairs, overlaps, shortName } from "./layout.ts";

const country = (id: string, neighbours: string[]): Country => ({
  id,
  name: id,
  region: "r",
  stability: 1,
  neighbours,
});

describe("neighbourPairs", () => {
  it("lists each pair of neighbours once, in the map's order", () => {
    const map: GameMap = {
      regions: [{ id: "r", name: "R" }],
      countries: [country("b", ["a", "c"]), country("a", ["b"]), country("c", ["b"])],
      closingOrder: [],
      battlegrounds: [],
      homeBox: { lio: [], sae: [] },
    };
    expect(neighbourPairs(map)).toEqual([
      ["b", "a"],
      ["b", "c"],
    ]);
  });

  it("gives the six-region map one line per pair: half its neighbour entries", () => {
    const map = sixRegionMapConfig().setup.map!;
    const entries = map.countries.reduce((n, c) => n + c.neighbours.length, 0);
    const pairs = neighbourPairs(map);
    expect(pairs).toHaveLength(entries / 2);
    expect(new Set(pairs.map(([a, b]) => [a, b].sort(byCodeUnit).join("|"))).size).toBe(pairs.length);
  });
});

describe("shortName", () => {
  it("keeps a name of 9 letters or fewer and cuts a longer one to 8 and a full stop", () => {
    expect(shortName("Venezuela")).toBe("Venezuela");
    expect(shortName("Democratic Republic")).toBe("Democrat.");
  });
});

describe("the rectangle tests", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  it("count touching edges as inside and as not overlapping", () => {
    expect(contains(a, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    expect(contains(a, { x: 1, y: 1, w: 10, h: 2 })).toBe(false);
    expect(overlaps(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps(a, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
  it("centre a marker box on its point and grow a rectangle on every side", () => {
    expect(markerBox({ x: 100, y: 50 })).toEqual({ x: 54, y: 26, w: 92, h: 48 });
    expect(grow(a, 2)).toEqual({ x: -2, y: -2, w: 14, h: 14 });
  });
});
