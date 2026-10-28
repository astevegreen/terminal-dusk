// The map's types (docs/design/map-and-points.md, "Map" and "Influence"). types.ts re-exports them, so index.ts
// exports the same names.
import type { EraId, Side } from "./types.ts";

export type RegionId = string;
export type CountryId = string;

/** A region of the map. */
export type Region = { id: RegionId; name: string };

/**
 * A country: its region, its stability (a whole number, 1 or more), and the countries next to it. Adjacency is
 * two-way: each neighbour lists this country too. Whether it is a battleground depends on the era (BattlegroundList).
 */
export type Country = {
  id: CountryId;
  name: string;
  region: RegionId;
  stability: number;
  neighbours: CountryId[];
};

/**
 * One era's battleground countries (docs/design/map-and-points.md, "Battlegrounds change by era"). The list may be
 * empty: an era can have no battlegrounds, in a region or anywhere.
 */
export type BattlegroundList = { era: EraId; countries: CountryId[] };

/**
 * The fixed map: regions and countries, each in order, and for each side the countries next to its home
 * box. Home boxes are not countries: they have no influence, stability or control. `closingOrder` lists the
 * three regions that close to interventions and realignments as Escalation reaches 3, 4 and 5, in that order
 * (docs/design/map-and-points.md, "Thresholds close regions"). `battlegrounds` holds one list per era
 * (battlegrounds.ts); every era's list is public, since only an era's cards and turn are secret.
 */
export type GameMap = {
  regions: Region[];
  closingOrder: RegionId[];
  countries: Country[];
  battlegrounds: BattlegroundList[];
  homeBox: Record<Side, CountryId[]>;
};

/** One country's influence for each side: whole numbers, 0 or more. */
export type InfluenceEntry = { country: CountryId; lio: number; sae: number };

/**
 * The map a setup gives: the fixed map plus each side's starting influence, each country at most once.
 * A country left out starts with no influence.
 */
export type SetupMap = GameMap & { startingInfluence: InfluenceEntry[] };
