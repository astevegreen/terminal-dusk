// The map's types (docs/design/map-and-points.md, "Map" and "Influence"). types.ts re-exports them, so index.ts
// exports the same names.
import type { Side } from "./types.ts";

export type RegionId = string;
export type CountryId = string;

/** A region of the map. */
export type Region = { id: RegionId; name: string };

/**
 * A country: its region, its stability (a whole number, 1 or more), whether it is a battleground, and the
 * countries next to it. Adjacency is two-way: each neighbour lists this country too.
 */
export type Country = {
  id: CountryId;
  name: string;
  region: RegionId;
  stability: number;
  battleground: boolean;
  neighbours: CountryId[];
};

/**
 * The fixed map: regions and countries, each in order, and for each side the countries next to its home
 * box. Home boxes are not countries: they have no influence, stability or control.
 */
export type GameMap = {
  regions: Region[];
  countries: Country[];
  homeBox: Record<Side, CountryId[]>;
};

/** One country's influence for each side: whole numbers, 0 or more. */
export type InfluenceEntry = { country: CountryId; lio: number; sae: number };

/**
 * The map a setup gives: the fixed map plus each side's starting influence, each country at most once.
 * A country left out starts with no influence.
 */
export type SetupMap = GameMap & { startingInfluence: InfluenceEntry[] };
