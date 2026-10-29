// The real-geography map's artwork (L3, #479), as `pnpm map:build` made it: every country of the six-region game
// has a shape, and the shape is around the country's true place, so each tint sits under the right marker's leader
// line. The borders are one path of whole-number lines, inside the size budget.
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { SIX_REGION_LAYOUT } from "../sixRegionLayout.ts";
import { WORLD_SIZE } from "./projection.ts";
import { WORLD_ART } from "./worldArt.ts";

type Ring = readonly (readonly [number, number])[];

/** A shape path's rings: it is only M, L and Z with whole numbers (the build makes nothing else). */
function ringsOf(d: string): Ring[] {
  return d
    .split("M")
    .filter((part) => part !== "")
    .map((part) =>
      part
        .replace(/Z$/, "")
        .split("L")
        .map((pair) => pair.split(" ").map(Number) as unknown as readonly [number, number]),
    );
}

/** Whether a point is inside a shape, by the even-odd rule over all its rings. */
function inside(rings: Ring[], x: number, y: number): boolean {
  let hits = 0;
  for (const ring of rings)
    ring.forEach(([ax, ay], i) => {
      const [bx, by] = ring[(i + 1) % ring.length]!;
      if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) hits++;
    });
  return hits % 2 === 1;
}

const map = sixRegionMapConfig().setup.map!;

describe("the world artwork", () => {
  it("is the six-region map's art, with NASA's credit", () => {
    expect(SIX_REGION_LAYOUT.art).toBe(WORLD_ART);
    expect(WORLD_ART.credit).toBe("Blue Marble imagery: NASA Earth Observatory");
  });

  it("has a shape of whole-number lines for every country of the game", () => {
    for (const c of map.countries) expect(WORLD_ART.shapes[c.id], c.id).toMatch(/^(M-?\d+ -?\d+(L-?\d+ -?\d+)+Z)+$/);
  });

  it("puts each country's true place inside its shape", () => {
    const outside = map.countries.filter((c) => {
      const p = SIX_REGION_LAYOUT.places![c.id]!;
      return !inside(ringsOf(WORLD_ART.shapes[c.id]!), p.x, p.y);
    });
    expect(outside.map((c) => c.id)).toEqual([]);
  });

  it("draws the borders as one path of whole-number lines, mostly inside the map", () => {
    expect(WORLD_ART.borders).toMatch(/^(M-?\d+ -?\d+(L-?\d+ -?\d+)+)+$/);
    const points = [...WORLD_ART.borders.matchAll(/(-?\d+) (-?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const within = points.filter(([x, y]) => x! >= 0 && x! <= WORLD_SIZE.w && y! >= 0 && y! <= WORLD_SIZE.h);
    expect(within.length / points.length).toBeGreaterThan(0.95);
  });

  it("keeps the shapes and borders under 300 KB, so the map loads quickly on a phone", () => {
    expect(JSON.stringify({ shapes: WORLD_ART.shapes, borders: WORLD_ART.borders }).length).toBeLessThan(300 * 1024);
  });
});
