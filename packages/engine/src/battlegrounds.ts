// Battlegrounds by era (docs/design/map-and-points.md, "Map": "each era has its own list"). The map holds one list
// per era, matched by the era's name; the public state's `era` says whose list counts now. A map may carry lists
// for eras a setup does not use, so one map serves any deck: those are never read.
import type { CountryId, PublicState, Setup, SetupMap } from "./types.ts";

/**
 * Why the map's battleground lists do not fit the setup, or null. Run after the map's shape and ids are checked.
 * A setup with a map names its first era; each of the game's eras (the first, then each setup era) has exactly
 * one list; no era has two; each list names known countries, each once. A list may be empty.
 */
export function battlegroundsError(setup: Setup, map: SetupMap): string | null {
  if (typeof setup.firstEra !== "string" || setup.firstEra.length === 0) {
    return "A setup with a map must name its first era (firstEra).";
  }
  const listed = new Set<string>();
  const ids = new Set(map.countries.map((c) => c.id));
  for (const list of map.battlegrounds) {
    if (listed.has(list.era)) return `The map has two battleground lists for era ${list.era}.`;
    listed.add(list.era);
    const seen = new Set<string>();
    for (const id of list.countries) {
      if (!ids.has(id)) return `Era ${list.era}'s battlegrounds name unknown country ${id}.`;
      if (seen.has(id)) return `Era ${list.era}'s battlegrounds name ${id} twice.`;
      seen.add(id);
    }
  }
  const eras = [setup.firstEra, ...(setup.eras ?? []).map((e) => e.era)];
  const missing = eras.find((era) => !listed.has(era));
  return missing === undefined ? null : `The map has no battleground list for era ${missing}.`;
}

/** Whether `country` is a battleground now: on the current era's list. False in a game with no map. */
export function isBattleground(pub: Pick<PublicState, "map" | "era">, country: CountryId): boolean {
  const list = pub.map?.battlegrounds.find((entry) => entry.era === pub.era);
  return list?.countries.includes(country) ?? false;
}
