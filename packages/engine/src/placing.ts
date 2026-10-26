// Spending points on placing influence (R16a; docs/design/map-and-points.md, "Influence", "Points and actions" and
// "Event points"). A spendPoints step, from a card played for points or from a card's event, gives its side the
// card's ops (as modified) to spend. Which countries it may place in is fixed when the step starts: influence
// placed earlier in the same play opens up no neighbours. Each influence costs 1, or 2 in a country the rival
// controls at that moment. The side places one influence per placeInfluence decision (hard rule 4), and must go
// on while a placement it can afford is left; points nothing can be bought with are lost (owner, 26 Oct, #315 a).
// All of a play's points go to one action (owner, 26 Oct, #316): when an intervention is possible too, the side
// first picks the action (chooseAction, R16b; intervening.ts).
import { newActionDecision, newPlaceDecision } from "./decisions.ts";
import { addInfluence, affordable, costNow, reachable } from "./influence.ts";
import { intervene, interveneTargets } from "./intervening.ts";
import { opsValue } from "./modifiers.ts";
import type { ActionAnswer, CountryId, EngineError, Frame, GameEvent, GameState, Side, Step } from "./types.ts";

type SpendStep = Extract<Step, { op: "spendPoints" }>;

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

/**
 * Runs `step`, the top frame's next step: says the points are spent (pointsSpent). With 1 point or more and a
 * country to intervene in, asks the side which action they go to ("paused"); otherwise fixes the countries the
 * side may place in and asks for the first placement ("paused"). With nothing to do (no map, no reach, or no
 * points) the frame moves on at once ("ran"). The printed ops are changed by the modifiers in force now, so an
 * event that ran just before counts (owner, 18 Oct).
 */
export function runSpendPoints(state: GameState, frame: Frame, step: SpendStep, events: GameEvent[]): "ran" | "paused" {
  const amount = opsValue(state, { ops: step.amount }, step.side);
  events.push({ kind: "pointsSpent", visibility: "public", side: step.side, amount });
  const targets = interveneTargets(state.public, step.side);
  if (amount > 0 && targets.length > 0) {
    state.public.pending = [newActionDecision(state.meta.seq, step.side, amount, targets)];
    return "paused";
  }
  return offer(state, frame, step.side, amount, reachable(state.public, step.side));
}

/**
 * Resumes the top frame, paused at a spendPoints step, with the action picked (apply has checked it against
 * legalAnswers): placing asks for the first placement, or moves on when none is affordable; an intervention
 * runs at once and the frame moves on. Anything else on top of the stack is a broken program.
 */
export function resumeAction(state: GameState, answer: ActionAnswer, events: GameEvent[]): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const decision = state.public.pending[0];
  if (!frame || step?.op !== "spendPoints" || decision?.kind !== "chooseAction" || !("targets" in decision.options)) {
    return invalidProgram("The stack is not paused at an action choice.");
  }
  const { points, targets } = decision.options;
  const side = decision.side;
  if (answer.action === "place") {
    offer(state, frame, side, points, reachable(state.public, side));
    return null;
  }
  if (!targets.includes(answer.country)) return invalidProgram("That country cannot take an intervention.");
  intervene(state, side, answer.country, points, events);
  state.public.pending = [];
  frame.next += 1;
  return null;
}

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
  offer(state, frame, side, points - cost, countries);
  return null;
}

/**
 * Asks `side` to place one influence with `points` left, in one of `countries`, while one is affordable;
 * otherwise clears the pending decision and moves the frame past its spendPoints step.
 */
function offer(state: GameState, frame: Frame, side: Side, points: number, countries: CountryId[]): "ran" | "paused" {
  if (affordable(state.public, side, countries, points).length > 0) {
    state.public.pending = [newPlaceDecision(state.meta.seq, side, points, countries)];
    return "paused";
  }
  state.public.pending = [];
  frame.next += 1;
  return "ran";
}
