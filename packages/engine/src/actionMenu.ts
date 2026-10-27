// The action menu (R16c, #317; docs/design/map-and-points.md, "Points and actions" and "Event points"). A
// spendPoints step, from a card played for points or from a card's event, gives its side the card's ops (as
// modified) to spend. All of them go to one action (owner, 26 Oct, #316): placing influence (placing.ts) or
// realigning (realign.ts). Realigning is never forced (owner, 26 Oct, #317 review), so whenever it is possible the
// side picks in a chooseAction decision: place or realign, or, when placing is impossible, realign or pass (the
// points left unspent). Without realigning, placing starts at once; with neither, the points are lost and the
// program runs on.
import { newActionDecision } from "./decisions.ts";
import { affordable, reachable, realignTargets } from "./influence.ts";
import { opsValue } from "./modifiers.ts";
import { offerPlacement, resumePlacement } from "./placing.ts";
import { offerRealign, resumeRealign } from "./realign.ts";
import type { AnswerValue, EngineError, Frame, GameEvent, GameState, PointsAction, Side, Step } from "./types.ts";

type SpendStep = Extract<Step, { op: "spendPoints" }>;

/**
 * Runs `step`, the top frame's next step: says the points are spent (pointsSpent), then offers the action menu
 * ("paused"), or moves the frame on at once when no action is possible ("ran"). The printed ops are changed by
 * the modifiers in force now, so an event that ran just before counts (owner, 18 Oct).
 */
export function runSpendPoints(state: GameState, frame: Frame, step: SpendStep, events: GameEvent[]): "ran" | "paused" {
  const amount = opsValue(state, { ops: step.amount }, step.side);
  events.push({ kind: "pointsSpent", visibility: "public", side: step.side, amount });
  const actions = possibleActions(state, step.side, amount);
  if (actions.includes("realign")) {
    const menu: PointsAction[] = actions.includes("place") ? actions : [...actions, "pass"];
    state.public.pending = [newActionDecision(state.meta.seq, step.side, amount, menu)];
    return "paused";
  }
  return start(state, frame, step.side, amount, actions[0] ?? "pass");
}

/**
 * Resumes the top frame, paused at a spendPoints step, with an answer about spending its points: the action
 * picked, a placing (placing.ts) or a realignment (realign.ts). Any other answer is a broken program.
 */
export function resumePoints(state: GameState, value: AnswerValue, events: GameEvent[]): EngineError | null {
  switch (value.kind) {
    case "chooseAction":
      return resumeAction(state, value.action);
    case "placeInfluence":
      return resumePlacement(state, value.country, events);
    case "realign":
      return resumeRealign(state, value.country, events);
    default:
      return { code: "invalidProgram", message: "That answer does not spend points." };
  }
}

/**
 * Resumes the top frame, paused at a spendPoints step's action menu, with the action picked (apply has checked
 * it against legalAnswers): that action starts with all the points. Anything else on top is a broken program.
 */
function resumeAction(state: GameState, action: PointsAction): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const decision = state.public.pending[0];
  if (!frame || step?.op !== "spendPoints" || decision?.kind !== "chooseAction" || !("actions" in decision.options)) {
    return { code: "invalidProgram", message: "The stack is not paused at the action menu." };
  }
  start(state, frame, decision.side, decision.options.points, action);
  return null;
}

/** The menu's actions `side` can spend `points` on now, in menu order: place, then realign. */
function possibleActions(state: GameState, side: Side, points: number): PointsAction[] {
  const actions: PointsAction[] = [];
  if (affordable(state.public, side, reachable(state.public, side), points).length > 0) actions.push("place");
  if (points > 0 && realignTargets(state.public, side).length > 0) actions.push("realign");
  return actions;
}

/**
 * Starts `action` for `side` with `points`: placing fixes the countries in reach now; realigning gives one
 * attempt per point. Either may find nothing to do and move the frame on. Passing spends nothing and moves the
 * frame on.
 */
function start(state: GameState, frame: Frame, side: Side, points: number, action: PointsAction): "ran" | "paused" {
  if (action === "place") return offerPlacement(state, frame, side, points, reachable(state.public, side));
  return offerRealign(state, frame, side, action === "realign" ? points : 0);
}
