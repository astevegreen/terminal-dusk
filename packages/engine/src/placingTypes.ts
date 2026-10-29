// The types of spending points on the action menu: placing influence (R16a), intervening (R16b) and the menu
// itself, which also offers realigning (R16c; its own types are in realignTypes.ts) (docs/design/map-and-points.md,
// "Influence" and "Points and actions"). types.ts re-exports them, so index.ts exports the same names.
import type { CountryId } from "./mapTypes.ts";
import type { Side } from "./types.ts";

/**
 * What a placeInfluence decision allows: `points` still to spend, and `countries`, the countries the side could
 * place in when the play started, in the map's order. That list stays fixed for the whole play (owner, 26 Oct,
 * #315 option a). All of it is public: the map and influence are.
 */
export type PlaceOptions = { points: number; countries: CountryId[] };

/**
 * A choice on the action menu. All of a play's points go to one action (owner, 26 Oct, #316): placing influence,
 * one intervention, or realigning. `pass` declines realigning when neither placing nor an intervention is
 * possible: the points are left unspent, since realigning is never forced (owner, 26 Oct, #317 review). `techRace`
 * spends them all on one tech race attempt (techRace.ts), only for a card played for its points.
 */
export type PointsAction = "place" | "intervene" | "realign" | "techRace" | "pass";

/**
 * What a chooseAction decision allows: `actions`, the choices the side has now with its `points`, in menu order
 * (place, intervene, realign, techRace, pass), and `targets`, the countries open to an intervention (the rival has influence
 * there and Escalation has not closed its region), in the map's order; empty when "intervene" is not offered.
 * Placing is offered while a placement is affordable. All of it is public.
 */
export type ActionOptions = { points: number; actions: PointsAction[]; targets: CountryId[] };

/** The answer to a chooseAction decision: an action, and for an intervention the country it goes to. */
export type ActionAnswer =
  | { kind: "chooseAction"; action: Exclude<PointsAction, "intervene"> }
  | { kind: "chooseAction"; action: "intervene"; country: CountryId };

/**
 * A `spendPoints` step started: `side`, who played the card (even when it is the rival's card), spends `amount`
 * action points, the card's ops as modified, on the action menu (placing.ts).
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

/**
 * One intervention (R16b): `side` spent `points` on `country`, of stability `stability`, and drew `draw` from its
 * Contingency deck. `result` is draw + points - 2 x stability; when above 0, `removed` rival influence came off
 * (stopping at 0) and `added` (the rest) went on as `side`'s own. Both are 0 when the result is 0 or less.
 */
export type Intervened = {
  kind: "intervened";
  visibility: "public";
  side: Side;
  country: CountryId;
  stability: number;
  points: number;
  draw: number;
  result: number;
  removed: number;
  added: number;
};
