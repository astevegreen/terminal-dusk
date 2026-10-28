// The action menu (R16b, R16c; docs/design/map-and-points.md, "Points and actions" and "Event points"). A
// spendPoints step, from a card played for points or from a card's event, gives its side the card's ops (as
// modified) to spend. All of them go to one action (owner, 26 Oct, #316): placing influence (placing.ts), one
// intervention (intervening.ts) or realigning (realign.ts). The side picks in a chooseAction decision whenever an
// intervention or a realignment is possible. Realigning is never forced (owner, 26 Oct, #317 review): when
// neither placing nor an intervention is possible, the menu also offers to pass, leaving the points unspent.
// With only placing possible it starts at once; with nothing possible the points are lost and the program runs on.
// Points spent at turn end only place influence (Turn-end-place: owner, 28 Oct, #426).
import { newActionDecision } from "./decisions.ts";
import { affordable, reachable, realignTargets } from "./influence.ts";
import { intervene, interveneTargets } from "./intervening.ts";
import { opsValue } from "./modifiers.ts";
import { offerPlacement, resumePlacement } from "./placing.ts";
import { offerRealign, resumeRealign } from "./realign.ts";
import type { ActionAnswer, AnswerValue, EngineError, Frame, GameEvent, GameState, PointsAction } from "./types.ts";
import type { Side, Step } from "./types.ts";

type SpendStep = Extract<Step, { op: "spendPoints" }>;

const invalidProgram = (message: string): EngineError => ({ code: "invalidProgram", message });

/**
 * Runs `step`, the top frame's next step: says the points are spent (pointsSpent), then offers the action menu
 * ("paused") when an intervention or a realignment is possible; otherwise starts placing, or moves the frame on at
 * once when no placement is affordable either ("ran"). The printed ops are changed by the modifiers in force now,
 * so an event that ran just before counts (owner, 18 Oct).
 *
 * Once the turnEnd hook has fired, every frame on the stack is one of its reactions: no step runs another card's
 * program, and the hook fires only on an empty stack. So a spend then is a turn-end payment and only places
 * influence (#426). A step that lets a reaction run a card's event would break this and must revisit it.
 */
export function runSpendPoints(state: GameState, frame: Frame, step: SpendStep, events: GameEvent[]): "ran" | "paused" {
  const { side } = step;
  const amount = opsValue(state, { ops: step.amount }, side);
  events.push({ kind: "pointsSpent", visibility: "public", side, amount });
  if (state.public.turnEndFired) return offerPlacement(state, frame, side, amount, reachable(state.public, side));
  const canPlace = affordable(state.public, side, reachable(state.public, side), amount).length > 0;
  const targets = amount > 0 ? interveneTargets(state.public, side) : [];
  const canRealign = amount > 0 && realignTargets(state.public, side).length > 0;
  if (targets.length === 0 && !canRealign)
    return offerPlacement(state, frame, side, amount, reachable(state.public, side));
  const actions: PointsAction[] = [];
  if (canPlace) actions.push("place");
  if (targets.length > 0) actions.push("intervene");
  if (canRealign) actions.push("realign");
  if (!canPlace && targets.length === 0) actions.push("pass");
  state.public.pending = [newActionDecision(state.meta.seq, side, amount, actions, targets)];
  return "paused";
}

/**
 * Resumes the top frame, paused at a spendPoints step, with an answer about spending its points: the action
 * picked, a placing (placing.ts) or a realignment (realign.ts). Any other answer is a broken program.
 */
export function resumePoints(state: GameState, value: AnswerValue, events: GameEvent[]): EngineError | null {
  switch (value.kind) {
    case "chooseAction":
      return resumeAction(state, value, events);
    case "placeInfluence":
      return resumePlacement(state, value.country, events);
    case "realign":
      return resumeRealign(state, value.country, events);
    default:
      return invalidProgram("That answer does not spend points.");
  }
}

/**
 * Resumes the top frame, paused at a spendPoints step's action menu, with the action picked (apply has checked it
 * against legalAnswers): placing fixes the countries in reach now and asks for the first placement; an
 * intervention runs at once and the frame moves on; realigning gives one attempt per point; passing spends
 * nothing and the frame moves on. Anything else on top of the stack is a broken program.
 */
function resumeAction(state: GameState, answer: ActionAnswer, events: GameEvent[]): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const decision = state.public.pending[0];
  if (!frame || step?.op !== "spendPoints" || decision?.kind !== "chooseAction" || !("actions" in decision.options)) {
    return invalidProgram("The stack is not paused at the action menu.");
  }
  const { points, targets } = decision.options;
  const side: Side = decision.side;
  switch (answer.action) {
    case "place":
      offerPlacement(state, frame, side, points, reachable(state.public, side));
      return null;
    case "intervene":
      if (!targets.includes(answer.country)) return invalidProgram("That country cannot take an intervention.");
      intervene(state, side, answer.country, points, events);
      state.public.pending = [];
      frame.next += 1;
      return null;
    case "realign":
    case "pass":
      offerRealign(state, frame, side, answer.action === "realign" ? points : 0);
      return null;
  }
}
