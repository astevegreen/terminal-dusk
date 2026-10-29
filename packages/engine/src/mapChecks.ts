// The setup's map (docs/design/map-and-points.md, "Map" and "Influence"): checking it, and the public state it
// starts. The map's content is scenario data; these checks only make sure it is a usable map.
import type { Country, EngineError, GameMap, InfluenceEntry, MapScoring, Setup, SetupMap } from "./types.ts";
import { battlegroundsError } from "./battlegrounds.ts";
import { CLOSING_THRESHOLDS } from "./closedRegions.ts";
import { scoringError } from "./scoring.ts";
import { copyTechRace, techRaceError } from "./techRace.ts";
import { SIDES } from "./types.ts";

const invalidSetup = (message: string): EngineError => ({ code: "invalidSetup", message });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isName = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Why the setup's map is unusable, or null. A setup with no map is fine. Never throws on bad input. */
export function mapError(setup: Setup): EngineError | null {
  if (setup.map === undefined) return null;
  const map: unknown = setup.map;
  const shape = shapeError(map);
  if (shape) return invalidSetup(shape);
  const m = map as SetupMap;
  const message =
    idsError(m) ??
    closingOrderError(m) ??
    adjacencyError(m) ??
    homeBoxError(m) ??
    influenceError(m) ??
    battlegroundsError(setup, m) ??
    scoringError(m) ??
    techRaceError(m);
  return message ? invalidSetup(message) : null;
}

/** The map's parts must be lists and objects of the right kinds before anything else is checked. */
function shapeError(map: unknown): string | null {
  if (!isObject(map)) return "The setup's map must be an object.";
  const { regions, closingOrder, countries, battlegrounds, homeBox, startingInfluence } = map;
  if (!Array.isArray(regions) || !regions.every(isObject)) return "The map's regions must be a list of regions.";
  if (!isStringList(closingOrder)) return "The map's closingOrder must be a list of region ids.";
  if (!Array.isArray(countries) || !countries.every(isObject))
    return "The map's countries must be a list of countries.";
  for (const c of countries) {
    if (!isStringList(c.neighbours)) return `Country ${String(c.id)}'s neighbours must be a list of country ids.`;
  }
  if (
    !Array.isArray(battlegrounds) ||
    !battlegrounds.every((b) => isObject(b) && isName(b.era) && isStringList(b.countries))
  ) {
    return "The map's battlegrounds must be a list of { era, countries } entries, one per era.";
  }
  if (!isObject(homeBox) || !SIDES.every((side) => isStringList(homeBox[side]))) {
    return "The map's homeBox needs a list of country ids for lio and for sae.";
  }
  if (!Array.isArray(startingInfluence) || !startingInfluence.every(isObject)) {
    return "The map's startingInfluence must be a list of entries.";
  }
  return null;
}

/** Ids and names: none empty, none repeated; each country in a known region with a whole stability, 1 or more. */
function idsError({ regions, countries }: SetupMap): string | null {
  if (regions.length === 0) return "The map has no regions.";
  if (countries.length === 0) return "The map has no countries.";
  const regionIds = new Set<string>();
  for (const r of regions) {
    if (!isName(r.id)) return "Each region needs an id that is not empty.";
    if (!isName(r.name)) return `Region ${r.id} needs a name that is not empty.`;
    if (regionIds.has(r.id)) return `Two regions share the id ${r.id}.`;
    regionIds.add(r.id);
  }
  const countryIds = new Set<string>();
  for (const c of countries) {
    if (!isName(c.id)) return "Each country needs an id that is not empty.";
    if (!isName(c.name)) return `Country ${c.id} needs a name that is not empty.`;
    if (countryIds.has(c.id)) return `Two countries share the id ${c.id}.`;
    countryIds.add(c.id);
    if (!regionIds.has(c.region)) return `Country ${c.id} names unknown region ${String(c.region)}.`;
    if (!Number.isInteger(c.stability) || c.stability < 1) {
      return `Country ${c.id}'s stability must be a whole number, 1 or more.`;
    }
  }
  const used = new Set(countries.map((c) => c.region));
  const empty = regions.find((r) => !used.has(r.id));
  return empty ? `Region ${empty.id} has no country.` : null;
}

/**
 * The closing order names exactly CLOSING_THRESHOLDS regions, one for each threshold (Escalation 3, 4 and 5), each a
 * known region and none twice.
 */
function closingOrderError({ regions, closingOrder }: SetupMap): string | null {
  if (closingOrder.length !== CLOSING_THRESHOLDS) {
    return (
      `The map's closingOrder must name exactly ${CLOSING_THRESHOLDS} regions, one per threshold; ` +
      `it has ${closingOrder.length}.`
    );
  }
  const regionIds = new Set(regions.map((r) => r.id));
  const seen = new Set<string>();
  for (const id of closingOrder) {
    if (!regionIds.has(id)) return `The map's closingOrder names unknown region ${id}.`;
    if (seen.has(id)) return `The map's closingOrder names ${id} twice.`;
    seen.add(id);
  }
  return null;
}

/** Each neighbour is a known country other than itself, listed once, that lists this country back. */
function adjacencyError({ countries }: SetupMap): string | null {
  const byId = new Map<string, Country>(countries.map((c) => [c.id, c]));
  for (const c of countries) {
    const seen = new Set<string>();
    for (const n of c.neighbours) {
      if (n === c.id) return `Country ${c.id} lists itself as a neighbour.`;
      if (seen.has(n)) return `Country ${c.id} lists neighbour ${n} twice.`;
      seen.add(n);
      const other = byId.get(n);
      if (!other) return `Country ${c.id} names unknown neighbour ${n}.`;
      if (!other.neighbours.includes(c.id)) {
        return `Country ${c.id} lists ${n} as a neighbour, but ${n} does not list ${c.id}.`;
      }
    }
  }
  return null;
}

/** Each side's home-box list names known countries, each once. */
function homeBoxError({ countries, homeBox }: SetupMap): string | null {
  const ids = new Set(countries.map((c) => c.id));
  for (const side of SIDES) {
    const seen = new Set<string>();
    for (const id of homeBox[side]) {
      if (!ids.has(id)) return `The ${side} home box names unknown country ${id}.`;
      if (seen.has(id)) return `The ${side} home box names ${id} twice.`;
      seen.add(id);
    }
  }
  return null;
}

/** Each starting-influence entry names a known country not already listed, with whole amounts, 0 or more. */
function influenceError({ countries, startingInfluence }: SetupMap): string | null {
  const ids = new Set(countries.map((c) => c.id));
  const seen = new Set<string>();
  for (const e of startingInfluence) {
    if (!ids.has(e.country)) return `Starting influence names unknown country ${String(e.country)}.`;
    if (seen.has(e.country)) return `Starting influence names ${e.country} twice.`;
    seen.add(e.country);
    for (const side of SIDES) {
      if (!Number.isInteger(e[side]) || e[side] < 0) {
        return `Starting influence in ${e.country}: the ${side} amount must be a whole number, 0 or more.`;
      }
    }
  }
  return null;
}

/** A fresh copy of a checked map's scoring. */
const copyScoring = ({ track, regions }: MapScoring): MapScoring => ({
  track: { end: track.end, start: track.start },
  regions: regions.map(({ region, present, ahead, all }) => ({ region, present, ahead, all })),
});

/**
 * The public state a checked map starts: the fixed map (no starting influence) and every country's influence,
 * in the map's country order, 0 where the setup gives none. Fresh copies: nothing is shared with the setup.
 */
export function mapState(map: SetupMap): { map: GameMap; influence: InfluenceEntry[] } {
  const start = new Map(map.startingInfluence.map((e) => [e.country, e]));
  return {
    map: {
      regions: map.regions.map(({ id, name }) => ({ id, name })),
      closingOrder: [...map.closingOrder],
      countries: map.countries.map(({ id, name, region, stability, neighbours }) => ({
        id,
        name,
        region,
        stability,
        neighbours: [...neighbours],
      })),
      battlegrounds: map.battlegrounds.map(({ era, countries }) => ({ era, countries: [...countries] })),
      homeBox: { lio: [...map.homeBox.lio], sae: [...map.homeBox.sae] },
      ...(map.scoring === undefined ? {} : { scoring: copyScoring(map.scoring) }),
      ...(map.techRace === undefined ? {} : { techRace: copyTechRace(map.techRace) }),
    },
    influence: map.countries.map(({ id }) => ({
      country: id,
      lio: start.get(id)?.lio ?? 0,
      sae: start.get(id)?.sae ?? 0,
    })),
  };
}
