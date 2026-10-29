// A drawing for any map that has no hand-made one (L2, #465), such as the test map: the two home boxes in a strip
// along the top, then the regions in a grid in the map's order, each the same size, with its countries in a grid
// under its name. On a map with scoring, a row under the name is left for the region's standings chip (L8, #488).
// Nothing overlaps, whatever the map (autoLayout.test.ts).
import type { CountryId, GameMap, RegionId } from "@terminal-dusk/engine";
import { CHIP, LABEL_BAND, MARKER } from "./layout.ts";
import type { MapLayout, Point, Rect } from "./layout.ts";

/** The space between markers, and between regions. */
const GAP = 8;
const CELL = { w: MARKER.w + GAP, h: MARKER.h + GAP };
const HOME_STRIP = CELL.h + GAP;

/** A grid of `count` cells: about as many columns as rows, at least 1 of each. */
function gridOf(count: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

export function autoLayout(map: GameMap): MapLayout {
  const outer = gridOf(map.regions.length);
  const most = Math.max(0, ...map.regions.map((r) => map.countries.filter((c) => c.region === r.id).length));
  const inner = gridOf(most);
  const scored = map.scoring !== undefined;
  const top = LABEL_BAND + (scored ? CHIP.h + 2 * GAP : 0);
  const region = {
    w: Math.max(inner.cols * CELL.w + GAP, scored ? CHIP.w + 2 * GAP : 0),
    h: top + inner.rows * CELL.h + GAP,
  };
  const size = {
    w: Math.max(GAP + outer.cols * (region.w + GAP), 2 * CELL.w + 2 * GAP),
    h: HOME_STRIP + outer.rows * (region.h + GAP),
  };

  const regions: Record<RegionId, Rect> = {};
  const countries: Record<CountryId, Point> = {};
  map.regions.forEach((r, i) => {
    const rect = {
      x: GAP + (i % outer.cols) * (region.w + GAP),
      y: HOME_STRIP + Math.floor(i / outer.cols) * (region.h + GAP),
      ...region,
    };
    regions[r.id] = rect;
    map.countries
      .filter((c) => c.region === r.id)
      .forEach((c, j) => {
        countries[c.id] = {
          x: rect.x + GAP + (j % inner.cols) * CELL.w + MARKER.w / 2,
          y: rect.y + top + Math.floor(j / inner.cols) * CELL.h + MARKER.h / 2,
        };
      });
  });
  const homeY = GAP + MARKER.h / 2;
  return {
    size,
    regions,
    countries,
    homes: { lio: { x: GAP + MARKER.w / 2, y: homeY }, sae: { x: size.w - GAP - MARKER.w / 2, y: homeY } },
    short: {},
  };
}
