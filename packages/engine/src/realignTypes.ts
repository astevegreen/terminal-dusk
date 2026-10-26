// The types of the action menu and of realigning (R16c, #317; docs/design/map-and-points.md, "Points and actions").
// types.ts re-exports them, so index.ts exports the same names.
import type { CountryId } from "./mapTypes.ts";
import type { Side } from "./types.ts";

/** An action on the menu a play's points may go to: placing influence or realigning. All of them go to one. */
export type PointsAction = "place" | "realign";

/**
 * What a chooseAction decision allows: the `actions` the side can use its `points` on now, in menu order
 * (place, then realign). It is asked only when more than one is possible. All of it is public.
 */
export type ActionOptions = { points: number; actions: PointsAction[] };

/**
 * What a realign decision allows: `attempts` still to make (one per point), and `targets`, the countries where
 * the rival has influence now, in the map's order. Each attempt may pick a different one. All of it is public.
 */
export type RealignOptions = { attempts: number; targets: CountryId[] };

/**
 * One realignment attempt by `side` in `country`. `totals` is each side's Contingency draw plus its bonuses
 * (1 per adjacent country it controls, 1 for more influence in the country, 1 if its home box touches it).
 * The side with the lower total, `loser`, lost `removed` influence there: the difference, stopping at 0.
 * A tie has no loser and removes nothing.
 */
export type Realigned = {
  kind: "realigned";
  visibility: "public";
  side: Side;
  country: CountryId;
  totals: Record<Side, number>;
  loser: Side | null;
  removed: number;
};
