// The Medium tier's board evaluation: how good the map is for a side, in era-end region scoring terms
// (docs/design/map-and-points.md, "Scoring"). Reads only the public state, so it works on a view or a guessed state.
import { closedRegions, controller } from "@terminal-dusk/engine";
import type { Country, PublicState, RegionAmounts, RegionId, Side } from "@terminal-dusk/engine";
import type { MediumWeights } from "./types.ts";

export const otherSide = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** What each controlled battleground adds to its region's score (the engine's BATTLEGROUND_POINT). */
const BATTLEGROUND_POINT = 1;

type Held = Map<string, Side | null>;

/** Each side's points in one region, the same levels as the engine's era-end scoring. */
export function regionPoints(
  amounts: RegionAmounts,
  countries: Country[],
  held: Held,
  bgs: Set<string>,
): Record<Side, number> {
  const ids = countries.filter((c) => c.region === amounts.region).map((c) => c.id);
  const regionBgs = ids.filter((id) => bgs.has(id));
  const count = (side: Side, list: string[]): number => list.filter((id) => held.get(id) === side).length;
  const points = (side: Side): number => {
    const mine = count(side, ids);
    const mineBgs = count(side, regionBgs);
    const rival = otherSide(side);
    const bonus = BATTLEGROUND_POINT * mineBgs;
    if (regionBgs.length > 0 && mineBgs === regionBgs.length) return amounts.all + bonus;
    const moreBgs = regionBgs.length === 0 || mineBgs > count(rival, regionBgs);
    if (mine > count(rival, ids) && moreBgs) return amounts.ahead + bonus;
    return mine > 0 ? amounts.present + bonus : 0;
  };
  return { lio: points("lio"), sae: points("sae") };
}

/** The share (0 to 1) of the way `side` is to controlling `country`: its influence over the stability it needs. */
export function controlProgress(pub: PublicState, country: Country, side: Side): number {
  const entry = pub.influence?.find((e) => e.country === country.id);
  if (entry === undefined) return 0;
  const own = entry[side];
  const lead = own - entry[otherSide(side)];
  return Math.max(0, Math.min(own, lead, country.stability)) / country.stability;
}

/** How much a region's terms count: more when it is closed, half as much more when it closes at the next level. */
export function regionFactor(pub: PublicState, region: RegionId, weights: MediumWeights): number {
  const closed = closedRegions(pub);
  if (closed.includes(region)) return 1 + weights.closed;
  const next = pub.map?.closingOrder[closed.length];
  return next === region ? 1 + weights.closed / 2 : 1;
}

/**
 * How good the board is for `side`: its lead over the rival in region scoring points as the map stands now, plus
 * its lead in the progress towards controlling countries, a battleground counting more. 0 on a map with no scoring.
 */
export function boardValue(pub: PublicState, side: Side, weights: MediumWeights): number {
  const map = pub.map;
  const scoring = map?.scoring;
  if (map === undefined || scoring === undefined) return 0;
  const rival = otherSide(side);
  const held: Held = new Map(map.countries.map((c) => [c.id, controller(pub, c.id)]));
  const now = new Set(map.battlegrounds.find((l) => l.era === pub.era)?.countries ?? []);
  // The lists run in era order, so the ones after the current era's are the later eras'; past eras' no longer count.
  const nowAt = map.battlegrounds.findIndex((l) => l.era === pub.era);
  const later = new Set(map.battlegrounds.slice(nowAt + 1).flatMap((l) => l.countries));
  const factors = new Map(map.regions.map((r) => [r.id, regionFactor(pub, r.id, weights)]));
  let value = 0;
  for (const amounts of scoring.regions) {
    const pts = regionPoints(amounts, map.countries, held, now);
    value += weights.region * (factors.get(amounts.region) ?? 1) * (pts[side] - pts[rival]);
  }
  for (const country of map.countries) {
    const bg = now.has(country.id) ? 1 : later.has(country.id) ? weights.later : 0;
    const lead = controlProgress(pub, country, side) - controlProgress(pub, country, rival);
    value += weights.progress * (1 + weights.battleground * bg) * (factors.get(country.region) ?? 1) * lead;
  }
  return value;
}
