// Where each region's standings chip sits (L8, #488), in layout units: the highest spot under the region's name, then
// the leftmost, where a CHIP-sized box stays inside the region and clear of every country marker, home box and
// true-place dot, with a small gap. The chip is drawn inside the map's one wrapper, so clear here is clear at every
// zoom. Worked out once per layout: a layout never changes.
import type { RegionId } from "@terminal-dusk/engine";
import { SIDES } from "@terminal-dusk/engine";
import { CHIP, contains, grow, markerArea, markerBox, overlaps } from "./layout.ts";
import type { MapLayout, Point, Rect } from "./layout.ts";

/** The space a chip keeps from anything it must not cover, and from the region's left edge. */
const GAP = 4;
/** How far a true-place dot reaches from its centre (artLayer.tsx draws it with radius 5). */
const DOT = 5;

/** The rectangle a chip whose top left corner is `at` covers. */
export const chipBox = (at: Point): Rect => ({ x: at.x, y: at.y, w: CHIP.w, h: CHIP.h });

/** Everything on the map a chip must leave in view, each grown by the gap. */
function obstaclesOf(layout: MapLayout): Rect[] {
  const dots = Object.values(layout.places ?? {}).map((p) => grow({ x: p.x, y: p.y, w: 0, h: 0 }, DOT));
  return [
    ...Object.values(layout.countries).map(markerBox),
    ...SIDES.map((side) => markerBox(layout.homes[side])),
    ...dots,
  ].map((r) => grow(r, GAP));
}

/** The chip's spot in `region`, or undefined when no spot is clear. */
function placeIn(region: Rect, obstacles: readonly Rect[]): Point | undefined {
  const area = markerArea(region);
  const near = obstacles.filter((o) => overlaps(o, area));
  // A clear spot's top touches the name band or an obstacle's bottom, and its left the region's edge or an obstacle's
  // right: so those are the only places to try, highest first, then leftmost.
  const ys = [area.y + GAP, ...near.map((o) => o.y + o.h)].toSorted((a, b) => a - b);
  const xs = [area.x + GAP, ...near.map((o) => o.x + o.w)].toSorted((a, b) => a - b);
  for (const y of ys)
    for (const x of xs) {
      const box = chipBox({ x, y });
      if (contains(area, box) && !near.some((o) => overlaps(o, box))) return { x, y };
    }
  return undefined;
}

const cache = new WeakMap<MapLayout, Readonly<Record<RegionId, Point>>>();

/** Each region's chip spot, by region id; a region with no clear spot has none. */
export function chipPlaces(layout: MapLayout): Readonly<Record<RegionId, Point>> {
  const known = cache.get(layout);
  if (known !== undefined) return known;
  const obstacles = obstaclesOf(layout);
  const places: Record<RegionId, Point> = {};
  for (const [id, rect] of Object.entries(layout.regions)) {
    const at = placeIn(rect, obstacles);
    if (at !== undefined) places[id] = at;
  }
  cache.set(layout, places);
  return places;
}
