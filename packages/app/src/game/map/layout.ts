// The drawn map's layout (L2, #465): where each region, country and home box sits, in whole numbers in a fixed
// space the map is drawn at, before it is scaled to fit the screen. Presentation data kept in the app, keyed by id
// (docs/architecture.md, Decision 4): never in the scenario, so it never reaches the game state or the ruleset hash.
import type { CountryId, GameMap, RegionId, Side } from "@terminal-dusk/engine";

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type MapLayout = {
  /** The whole drawing's size, in layout units (CSS px before scaling). */
  size: Size;
  /** One rectangle per region. */
  regions: Readonly<Record<RegionId, Rect>>;
  /** The centre of each country's marker. */
  countries: Readonly<Record<CountryId, Point>>;
  /** The centre of each side's home box marker. */
  homes: Readonly<Record<Side, Point>>;
  /** Short names for markers; a country left out shows `shortName` of its full name. */
  short: Readonly<Record<CountryId, string>>;
  /** Each country's true place on a real-geography map (L3, #479); a marker away from it gets a leader line. */
  places?: Readonly<Record<CountryId, Point>>;
  /** The real-geography map's picture, country shapes and borders, drawn under the markers. */
  art?: WorldArt;
};

/** The real-geography map's artwork (L3, #479), all in layout units: presentation data, never in the game state. */
export type WorldArt = {
  /** The bundled picture's URL, drawn at the layout's size. */
  picture: string;
  /** The credit the picture's source asks for, shown with the map. */
  credit: string;
  /** One SVG path per country of the map, which its region's tint fills. */
  shapes: Readonly<Record<CountryId, string>>;
  /** The land borders between countries, as one SVG path. */
  borders: string;
};

/** A line from a marker's centre to its country's true place, when the place is not under the marker. */
export type Leader = { country: CountryId; from: Point; to: Point };

/** The longest a leader line may be, in layout units, so every marker stays near its place. */
export const LEADER_MAX = 180;

/** Every marker's size, country or home box, in layout units. */
export const MARKER: Size = { w: 92, h: 48 };
/** The band at the top of each region rectangle that holds the region's name; no marker sits in it. */
export const LABEL_BAND = 26;
/** A region's standings chip (L8, #488): two lines, one per side, wide enough for "SAE every battleground 11". */
export const CHIP: Size = { w: 220, h: 44 };
/** The longest name a marker shows. */
export const SHORT_MAX = 9;

/** A name cut to fit a marker: as it is when short enough, otherwise its first letters and a full stop. */
export function shortName(name: string): string {
  return name.length <= SHORT_MAX ? name : `${name.slice(0, SHORT_MAX - 1)}.`;
}

/** The rectangle a marker centred on `p` covers. */
export const markerBox = (p: Point): Rect => ({
  x: p.x - MARKER.w / 2,
  y: p.y - MARKER.h / 2,
  w: MARKER.w,
  h: MARKER.h,
});

/** The whole drawing as a rectangle. */
export const wholeRect = (layout: MapLayout): Rect => ({ x: 0, y: 0, w: layout.size.w, h: layout.size.h });

/** Whether `inner` lies wholly inside `outer` (touching the edge counts as inside). */
export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/** Whether two rectangles share any area (touching edges do not). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The part of a region's rectangle under its name band, where its markers sit. */
export const markerArea = (rect: Rect): Rect => ({
  x: rect.x,
  y: rect.y + LABEL_BAND,
  w: rect.w,
  h: rect.h - LABEL_BAND,
});

/** A rectangle grown by `by` on every side. */
export const grow = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  w: rect.w + 2 * by,
  h: rect.h + 2 * by,
});

/** Each pair of neighbouring countries once, in the map's order: [a, b] where a comes first in the map's list. */
export function neighbourPairs(map: GameMap): [CountryId, CountryId][] {
  const order = new Map(map.countries.map((c, i) => [c.id, i]));
  const pairs: [CountryId, CountryId][] = [];
  for (const country of map.countries) {
    const at = order.get(country.id) ?? 0;
    for (const next of country.neighbours) {
      const other = order.get(next);
      if (other !== undefined && other > at) pairs.push([country.id, next]);
    }
  }
  return pairs;
}

/** Whether `layout` places every region and every country of `map`. */
export function covers(layout: MapLayout, map: GameMap): boolean {
  return (
    map.regions.every((r) => Object.hasOwn(layout.regions, r.id)) &&
    map.countries.every((c) => Object.hasOwn(layout.countries, c.id))
  );
}

/** Whether point `p` lies inside or on the edge of `rect`. */
export const holds = (rect: Rect, p: Point): boolean =>
  p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;

/** A leader line for each country whose true place is not under its marker, in the order of `places`. */
export function leaderLines(layout: MapLayout): Leader[] {
  const leaders: Leader[] = [];
  for (const [country, to] of Object.entries(layout.places ?? {})) {
    const from = layout.countries[country];
    if (from !== undefined && !holds(markerBox(from), to)) leaders.push({ country, from, to });
  }
  return leaders;
}
