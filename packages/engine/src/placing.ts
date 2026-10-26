// Spending points on placing influence (R16a; docs/design/map-and-points.md, "Influence", "Points and actions" and
// "Event points"). Once a spendPoints step's points go to placing (actionMenu.ts), which countries the side may
// place in is fixed: influence placed earlier in the same play opens up no neighbours. Each influence costs 1, or
// 2 in a country the rival controls at that moment. The side places one influence per placeInfluence decision
// (hard rule 4), and must go on while a placement it can afford is left; points nothing can be bought with are
// lost (owner, 26 Oct, #315 a).
import { newPlaceDecision } from "./decisions.ts";
import { addInfluence, affordable, costNow } from "./influence.ts";
import type { CountryId, EngineError, Frame, GameEvent, GameState, Side } from "./types.ts";

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

/**
 * Resumes the top frame, paused at a spendPoints step, with the country picked (apply has checked it against
 * legalAnswers): one influence goes there at its cost now, then the next placement is asked for, or the frame
 * moves on. Anything else on top of the stack is a broken program.
 */
export function resumePlacement(state: GameState, country: CountryId, events: GameEvent[]): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const decision = state.public.pending[0];
  if (
    !frame ||
    step?.op !== "spendPoints" ||
    decision?.kind !== "placeInfluence" ||
    !("countries" in decision.options)
  ) {
    return invalidProgram("The stack is not paused at a placing.");
  }
  const { points, countries } = decision.options;
  const side = decision.side;
  if (!affordable(state.public, side, countries, points).includes(country)) {
    return invalidProgram("That country cannot take an influence now.");
  }
  const cost = costNow(state.public, side, country);
  const influence = addInfluence(state, side, country, 1).public.influence;
  if (influence !== undefined) state.public.influence = influence;
  events.push({ kind: "influencePlaced", visibility: "public", side, country, cost });
  offerPlacement(state, frame, side, points - cost, countries);
  return null;
}

/**
 * Asks `side` to place one influence with `points` left, in one of `countries`, while one is affordable;
 * otherwise clears the pending decision and moves the frame past its spendPoints step.
 */
export function offerPlacement(
  state: GameState,
  frame: Frame,
  side: Side,
  points: number,
  countries: CountryId[],
): "ran" | "paused" {
  if (affordable(state.public, side, countries, points).length > 0) {
    state.public.pending = [newPlaceDecision(state.meta.seq, side, points, countries)];
    return "paused";
  }
  state.public.pending = [];
  frame.next += 1;
  return "ran";
}
