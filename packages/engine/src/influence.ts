// The influence rules (docs/design/map-and-points.md, "Influence"): who controls a country, whether a side may
// place one influence there and at what cost, and adding and removing influence, which always stops at 0.
// controller and placementCost read only the public state, so the app and AI can call them on a view.
import { otherSide, SIDES } from "./types.ts";
import type { Country, CountryId, GameState, InfluenceEntry, PublicState, Side } from "./types.ts";

/** The country and its influence entry, or null when the game has no map or does not know `country`. */
function lookup(state: PublicState, country: CountryId): { def: Country; entry: InfluenceEntry } | null {
  const def = state.map?.countries.find((c) => c.id === country);
  const entry = state.influence?.find((e) => e.country === country);
  return def === undefined || entry === undefined ? null : { def, entry };
}

/** Who controls `entry`'s country of stability `stability`, or null. */
function controlOf(entry: InfluenceEntry, stability: number): Side | null {
  for (const side of SIDES) {
    const own = entry[side];
    if (own >= stability && own >= entry[otherSide(side)] + stability) return side;
  }
  return null;
}

/**
 * The side that controls `country`: its influence there is at least the stability and at least the rival's
 * influence plus the stability. Null when nobody does, the game has no map, or the country is unknown.
 */
export function controller(state: PublicState, country: CountryId): Side | null {
  const found = lookup(state, country);
  return found === null ? null : controlOf(found.entry, found.def.stability);
}

/**
 * What one influence costs `side` in `country`, as the state is now: null (not allowed) unless the side has
 * influence there or in a neighbour, or the country is next to the side's home box; then 2 if the rival
 * controls the country, otherwise 1. Null too when the game has no map or the country is unknown.
 */
export function placementCost(state: PublicState, side: Side, country: CountryId): 1 | 2 | null {
  const found = lookup(state, country);
  if (found === null || state.map === undefined) return null;
  const { def, entry } = found;
  const hasIn = (id: CountryId): boolean => (state.influence?.find((e) => e.country === id)?.[side] ?? 0) > 0;
  const reachable = hasIn(country) || def.neighbours.some(hasIn) || state.map.homeBox[side].includes(country);
  if (!reachable) return null;
  return controlOf(entry, def.stability) === otherSide(side) ? 2 : 1;
}

/** `state` with `side`'s count in `country` set by `change`, or `state` itself when nothing may change. */
function changeInfluence(
  state: GameState,
  side: Side,
  country: CountryId,
  n: number,
  change: (current: number) => number,
): GameState {
  if (!Number.isInteger(n) || n < 0 || lookup(state.public, country) === null) return state;
  const influence = state.public.influence!.map((e) => (e.country === country ? { ...e, [side]: change(e[side]) } : e));
  return { ...state, public: { ...state.public, influence } };
}

/** `state` with `side`'s influence in `country` raised by `n`. Unchanged for no map, an unknown country or a bad n. */
export function addInfluence(state: GameState, side: Side, country: CountryId, n: number): GameState {
  return changeInfluence(state, side, country, n, (current) => current + n);
}

/** `state` with `side`'s influence in `country` lowered by `n`, stopping at 0. Unchanged as for addInfluence. */
export function removeInfluence(state: GameState, side: Side, country: CountryId, n: number): GameState {
  return changeInfluence(state, side, country, n, (current) => Math.max(0, current - n));
}
