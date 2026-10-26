// The types of spending points on placing influence (R16a; docs/design/map-and-points.md, "Influence" and
// "Points and actions"). types.ts re-exports them, so index.ts exports the same names.
import type { CountryId } from "./mapTypes.ts";
import type { Side } from "./types.ts";

/**
 * What a placeInfluence decision allows: `points` still to spend, and `countries`, the countries the side could
 * place in when the play started, in the map's order. That list stays fixed for the whole play (owner, 26 Oct,
 * #315 option a). All of it is public: the map and influence are.
 */
export type PlaceOptions = { points: number; countries: CountryId[] };

/**
 * A `spendPoints` step started: `side`, who played the card (even when it is the rival's card), spends `amount`
 * action points, the card's ops as modified, on placing influence (placing.ts).
 */
export type PointsSpent = { kind: "pointsSpent"; visibility: "public"; side: Side; amount: number };

/** One influence placed: `side` put 1 influence in `country` for `cost` points (2 where the rival controlled it). */
export type InfluencePlaced = {
  kind: "influencePlaced";
  visibility: "public";
  side: Side;
  country: CountryId;
  cost: number;
};
