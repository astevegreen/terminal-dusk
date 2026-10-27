// The map numbers of the balance report, on a scenario with a map. One game's numbers come only from what the match
// host hands out: the final public view (the influence on the map, and control through the engine's own
// `controller`) and the public events of every step (what each action of the menu spent). Nothing here re-works a
// placing cost, a modifier or the control rule.
import { controller } from "@terminal-dusk/engine";

export const SIDES = ["lio", "sae"];
/** The actions of the menu that spend points, in menu order ("pass" spends none). */
export const ACTIONS = ["place", "intervene", "realign"];

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const zeroSpent = () => Object.fromEntries(ACTIONS.map((action) => [action, 0]));

/**
 * What the public events say each action spent: placing, each influencePlaced event's `cost`; an intervention, its
 * intervened event's `points`; realigning, one point per realigned event (one attempt per point).
 */
function spentBy(event) {
  switch (event.kind) {
    case "influencePlaced":
      return ["place", event.cost];
    case "intervened":
      return ["intervene", event.points];
    case "realigned":
      return ["realign", 1];
    default:
      return null;
  }
}

/**
 * One game's map numbers: per side, its influence on the map and the countries it controls in `finalPublic` (the
 * final view's public part), and the points it spent on each action according to `events` (every public event of
 * the game, oldest first). Null when the game has no map.
 */
export function mapSummary(finalPublic, events) {
  if (finalPublic.map === undefined) return null;
  const result = Object.fromEntries(SIDES.map((s) => [s, { influence: 0, controlled: 0, spent: zeroSpent() }]));
  for (const entry of finalPublic.influence ?? []) {
    for (const side of SIDES) result[side].influence += entry[side];
  }
  for (const country of finalPublic.map.countries) {
    const side = controller(finalPublic, country.id);
    if (side !== null) result[side].controlled += 1;
  }
  for (const event of events) {
    const spent = spentBy(event);
    if (spent !== null) result[event.side].spent[spent[0]] += spent[1];
  }
  return result;
}

/**
 * The report's map numbers for `summaries` (each with its `map` from mapSummary): per side, the averages per game
 * of influence on the map and countries controlled at game end, and of points spent on each action. Undefined when
 * no game has a map, so a report without a map has no such rows.
 */
export function mapNumbers(summaries) {
  const games = summaries.filter((game) => game.map !== null && game.map !== undefined);
  if (games.length === 0) return undefined;
  const average = (pick) => round(games.reduce((n, game) => n + pick(game.map), 0) / games.length, 2);
  return Object.fromEntries(
    SIDES.map((side) => [
      side,
      {
        influence: average((map) => map[side].influence),
        controlled: average((map) => map[side].controlled),
        spent: Object.fromEntries(ACTIONS.map((action) => [action, average((map) => map[side].spent[action])])),
      },
    ]),
  );
}
