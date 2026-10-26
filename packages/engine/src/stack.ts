// The resolution stack: runs program steps until one needs a player's choice, records that as the
// pending decision (or, for both sides at once, a simultaneous pair) and stops. The answer resumes
// exactly where it stopped. A step budget per call (createGame or apply) stops runaway programs.
import { notANumber, testCondition, unbound } from "./conditions.ts";
import { deckFor, drawContingency } from "./contingency.ts";
import { copyJson } from "./copy.ts";
import { newDecision, newGroup } from "./decisions.ts";
import { resumeDiscard, runDiscard } from "./discardChoice.ts";
import { runEscalate } from "./escalateStep.ts";
import { revealHand } from "./knowledge.ts";
import { keepMarker } from "./markers.ts";
import { startModifier } from "./modifiers.ts";
import { resumePoints, runSpendPoints } from "./actionMenu.ts";
import { halfAnswered } from "./simultaneous.ts";
import type { Revealed } from "./simultaneous.ts";
import { afterProgram, setTrigger } from "./triggers.ts";
import type {
  AnswerValue,
  Binding,
  CardId,
  EngineError,
  EngineErrorCode,
  Frame,
  GameEvent,
  GameState,
  MarkerEvent,
  Result,
  Ruleset,
  Side,
  Step,
  VarName,
  VarValue,
} from "./types.ts";

const DEFAULT_STEP_BUDGET = 10_000;

/**
 * The steps one call has run so far, and the most it may run: the ruleset's limit, else 10,000. Each
 * call makes a new one and shares it with everything it runs; it is never stored in the state.
 */
export type Budget = { used: number; limit: number };
export const newBudget = (ruleset: Ruleset): Budget => ({
  used: 0,
  limit: ruleset.limits?.stepBudget ?? DEFAULT_STEP_BUDGET,
});

const problem = (code: EngineErrorCode, message: string): EngineError => ({ code, message });

/**
 * Starts `steps` as a program and runs it until it pauses or ends. If it pauses, its choice replaces
 * the pending decisions. Internal: index.ts does not export it. Engine tests start programs with it;
 * real games start them from the turn structure (turn.ts), through runProgram. `source`, if given, is
 * the card the program runs for, `player` the side that played it and `worldFor` as in runProgram.
 */
export function startProgram(
  ruleset: Ruleset,
  state: GameState,
  steps: Step[],
  source?: CardId,
  player?: Side,
  worldFor?: Side,
): Result<{ state: GameState; events: GameEvent[] }> {
  if (ruleset.id !== state.meta.ruleset) {
    return { ok: false, error: problem("rulesetMismatch", "That ruleset is not the one this game started with.") };
  }
  if (state.public.status.kind === "over") return { ok: false, error: problem("gameOver", "The game is over.") };
  if (state.public.stack.length > 0) {
    return { ok: false, error: problem("notSupported", "A program is already running.") };
  }
  if (halfAnswered(state)) {
    return { ok: false, error: problem("notSupported", "A simultaneous choice is half answered.") };
  }
  const next = copyJson(state);
  next.meta.seq += 1;
  const events: GameEvent[] = [];
  const error = runProgram(next, steps, events, newBudget(ruleset), source, player, worldFor);
  return error ? { ok: false, error } : { ok: true, value: { state: next, events } };
}

/**
 * Pushes `steps` as a new program and runs it until it pauses or ends. `source` is the card whose effect
 * or play it runs, if any, and `player` the side that picked or played it, given for a card's event.
 * `worldFor`, given when that card is the rival's, is its owner (contingency.ts, `deckFor`). The frame
 * records all three. Edits `state`, a working copy.
 */
export function runProgram(
  state: GameState,
  steps: Step[],
  events: GameEvent[],
  budget: Budget,
  source?: CardId,
  player?: Side,
  worldFor?: Side,
): EngineError | null {
  const frame: Frame = { kind: "program", steps: copyJson(steps), next: 0, vars: [] };
  if (source !== undefined) frame.source = source;
  if (player !== undefined) frame.player = player;
  if (worldFor !== undefined) frame.worldFor = worldFor;
  state.public.stack.push(frame);
  return runStack(state, events, budget);
}

/** What closed a paused `choose`: one side's answer, or both sides' answers to a simultaneous pair. */
export type Closing = { who: Side; value: AnswerValue } | { who: "both"; values: Revealed };

/**
 * Resumes a paused program once its `choose` is closed: binds the answer (for a pair, both answers
 * keyed by side), then runs on. A discard pick resumes its discardFromHand step (discardChoice.ts), and an
 * action picked, a placing or a realignment its spendPoints step, which may ask again (actionMenu.ts).
 * Edits `state`, a working copy, in place.
 */
export function resumeStack(
  state: GameState,
  closing: Closing,
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
  if (closing.who !== "both" && closing.value.kind === "discardCards") {
    return resumeDiscard(state, closing.value.cards, events) ?? runStack(state, events, budget);
  }
  if (closing.who !== "both" && ["placeInfluence", "chooseAction", "realign"].includes(closing.value.kind)) {
    const error = resumePoints(state, closing.value, events);
    if (error !== null || state.public.pending.length > 0) return error;
    return runStack(state, events, budget);
  }
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  const value = boundValue(closing);
  const kind = closing.who === "both" ? closing.values.lio.kind : closing.value.kind;
  const matches = step?.op === "choose" && (step.who === "both") === (closing.who === "both");
  if (!frame || !matches || step.decision.kind !== kind || value === undefined) {
    return problem("invalidProgram", "The stack is not paused at a matching choice.");
  }
  bind(frame, step.bind, value);
  frame.next += 1;
  state.public.pending = [];
  return runStack(state, events, budget);
}

/** What running one step did: ran on, paused at a choice, or found a broken program. */
type StepOutcome = "ran" | "paused" | EngineError;
type StepOf<K extends Step["op"]> = Extract<Step, { op: K }>;

/**
 * Runs the top frame's steps until a `choose` pauses the stack or the stack is empty. Each step run
 * counts once against `budget`; going over returns stepBudgetExceeded. A finished program may fire the
 * cardPlayed hook, whose reactions then run on the same stack (triggers.ts).
 */
export function runStack(state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const stack = state.public.stack;
  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    const step = frame.steps[frame.next];
    if (step === undefined) {
      if (finishBlock(stack, frame)) afterProgram(state, frame, events);
      continue;
    }
    budget.used += 1;
    if (budget.used > budget.limit) {
      return problem("stepBudgetExceeded", `More than ${budget.limit} steps would run in one call.`);
    }
    const outcome = runStep(state, frame, step, events);
    if (outcome === "paused") return null;
    if (outcome !== "ran") return outcome;
  }
  return null;
}

/** Runs one step of the top frame. */
function runStep(state: GameState, frame: Frame, step: Step, events: GameEvent[]): StepOutcome {
  switch (step.op) {
    case "choose":
      state.public.pending =
        step.who === "both"
          ? newGroup(state.meta.seq, step.decision.kind)
          : [newDecision(state.meta.seq, step.who, step.decision.kind)];
      return "paused";
    case "marker":
      return runMarker(state, frame, step, events);
    case "if":
      return runIf(state, frame, step);
    case "forEach":
      return runForEach(state.public.stack, frame, step);
    case "spendPoints":
      return runSpendPoints(state, frame, step, events);
    case "modifier":
    case "trigger": {
      const { source, player, worldFor } = programFrame(state.public.stack) ?? {};
      if (source === undefined) return problem("invalidProgram", `A ${step.op} step needs the card it runs for.`);
      if (step.op === "modifier") startModifier(state, source, step, events);
      else setTrigger(state, source, step, events, { player, worldFor });
      frame.next += 1;
      return "ran";
    }
    case "addToNumber":
      return runAddToNumber(state.public.stack, frame, step);
    case "drawContingency": {
      const deck = deckFor(step.side, programFrame(state.public.stack));
      if (deck === undefined)
        return problem("invalidProgram", "A draw from the player's deck needs the side that played the card.");
      const value = drawContingency(state, deck, events);
      if (step.bind !== undefined) bind(frame, step.bind, value);
      frame.next += 1;
      return "ran";
    }
    case "revealHand":
      revealHand(state, step.side, events);
      frame.next += 1;
      return "ran";
    case "discardFromHand":
      return runDiscard(state, frame, step, events, programFrame(state.public.stack)?.player);
    case "escalate": {
      const error = runEscalate(state, step, programFrame(state.public.stack)?.player, events);
      if (error !== null) return error;
      frame.next += 1;
      return "ran";
    }
  }
}

/**
 * Emits a public marker event, with the named variable's value if the step names one. A lasting marker's
 * event says so, and its label (only the label) is kept in `markers`.
 */
function runMarker(state: GameState, frame: Frame, step: StepOf<"marker">, events: GameEvent[]): StepOutcome {
  const event: MarkerEvent = { kind: "marker", visibility: "public", label: step.label };
  if (step.var !== undefined) {
    const value = lookup(state.public.stack, step.var);
    if (value === undefined) return unbound(step.var);
    event.value = value;
  }
  if (step.lasting === true) {
    event.lasting = true;
    keepMarker(state, step.label);
  }
  events.push(event);
  frame.next += 1;
  return "ran";
}

/** Pushes the branch the condition picks, unless that branch is empty. */
function runIf(state: GameState, frame: Frame, step: StepOf<"if">): StepOutcome {
  const stack = state.public.stack;
  const yes = testCondition(state, step.cond, (name) => lookup(stack, name), programFrame(stack)?.player);
  if (typeof yes !== "boolean") return yes;
  frame.next += 1;
  const branch = yes ? step.then : (step.else ?? []);
  if (branch.length > 0) stack.push({ kind: "if", steps: branch, next: 0, vars: [] });
  return "ran";
}

/** Adds the step's amount to the number bound to its variable, in the frame that holds the binding. */
function runAddToNumber(stack: Frame[], frame: Frame, step: StepOf<"addToNumber">): StepOutcome {
  const found = findBinding(stack, step.var);
  if (found === undefined) return unbound(step.var);
  if (typeof found.value !== "number") return notANumber(step.var, "addToNumber");
  found.value += step.amount;
  frame.next += 1;
  return "ran";
}

/** Pushes a loop frame with the first item bound, unless the list is empty. */
function runForEach(stack: Frame[], frame: Frame, step: StepOf<"forEach">): StepOutcome {
  frame.next += 1;
  const first = step.over[0];
  if (first === undefined) return "ran";
  stack.push({
    kind: "forEach",
    steps: step.do,
    next: 0,
    vars: [{ name: step.bind, value: first }],
    bind: step.bind,
    items: step.over,
    index: 0,
  });
  return "ran";
}

/**
 * The value a closed `choose` binds: a yes/no; or, for a pair, both sides' yes/no or both picked cards,
 * keyed by side. Undefined when the answers don't fit the choice.
 */
function boundValue(closing: Closing): VarValue | undefined {
  if (closing.who !== "both") return closing.value.kind === "yesNo" ? closing.value.yes : undefined;
  const { lio, sae } = closing.values;
  if (lio.kind === "yesNo" && sae.kind === "yesNo") return { lio: lio.yes, sae: sae.yes };
  if (lio.kind === "chooseCard" && sae.kind === "chooseCard") return { lio: lio.card, sae: sae.card };
  return undefined;
}

/**
 * The top frame's steps are done: a forEach moves to its next item, any other frame is removed. True when
 * the frame left the stack.
 */
function finishBlock(stack: Frame[], frame: Frame): boolean {
  const nextItem = frame.kind === "forEach" ? frame.items[frame.index + 1] : undefined;
  if (frame.kind === "forEach" && nextItem !== undefined) {
    frame.index += 1;
    frame.next = 0;
    frame.vars = [{ name: frame.bind, value: nextItem }];
    return false;
  }
  stack.pop();
  return true;
}

/** A variable's value, looked up from the innermost block outward, within the running program. */
function lookup(stack: Frame[], name: VarName): VarValue | undefined {
  return findBinding(stack, name)?.value;
}

/** The binding of `name`, looked up from the innermost block outward, within the running program. */
function findBinding(stack: Frame[], name: VarName): Binding | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i]!;
    const found = frame.vars.find((b) => b.name === name);
    if (found) return found;
    if (frame.kind === "program") break;
  }
  return undefined;
}

/** The running program's frame, read through any if or forEach blocks: its `source` and `player`. */
function programFrame(stack: Frame[]): Extract<Frame, { kind: "program" }> | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i]!;
    if (frame.kind === "program") return frame;
  }
  return undefined;
}

/** Binds `name` in `frame`, replacing an earlier value with the same name. */
function bind(frame: Frame, name: VarName, value: VarValue): void {
  const found = frame.vars.find((b) => b.name === name);
  if (found) found.value = value;
  else frame.vars.push({ name, value });
}
