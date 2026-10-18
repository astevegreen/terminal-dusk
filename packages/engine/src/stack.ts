// The resolution stack: runs program steps until one needs a player's choice, records that as the
// pending decision (or, for both sides at once, a simultaneous pair) and stops. The answer resumes
// exactly where it stopped. A step budget per call (createGame or apply) stops runaway programs.
import { drawContingency } from "./contingency.ts";
import { copyJson } from "./copy.ts";
import { newDecision, newGroup } from "./decisions.ts";
import { opsValue, startModifier } from "./modifiers.ts";
import { halfAnswered } from "./simultaneous.ts";
import type { Revealed } from "./simultaneous.ts";
import type {
  AnswerValue,
  Binding,
  CardId,
  Condition,
  EngineError,
  EngineErrorCode,
  Frame,
  GameEvent,
  GameState,
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
 * the card the program runs for.
 */
export function startProgram(
  ruleset: Ruleset,
  state: GameState,
  steps: Step[],
  source?: CardId,
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
  const error = runProgram(next, steps, events, newBudget(ruleset), source);
  return error ? { ok: false, error } : { ok: true, value: { state: next, events } };
}

/**
 * Pushes `steps` as a new program and runs it until it pauses or ends. `source` is the card whose effect
 * or play it runs, if any: the frame records it. Edits `state`, a working copy.
 */
export function runProgram(
  state: GameState,
  steps: Step[],
  events: GameEvent[],
  budget: Budget,
  source?: CardId,
): EngineError | null {
  const frame: Frame = { kind: "program", steps: copyJson(steps), next: 0, vars: [] };
  if (source !== undefined) frame.source = source;
  state.public.stack.push(frame);
  return runStack(state, events, budget);
}

/** What closed a paused `choose`: one side's answer, or both sides' answers to a simultaneous pair. */
export type Closing = { who: Side; value: AnswerValue } | { who: "both"; values: Revealed };

/**
 * Resumes a paused program once its `choose` is closed: binds the answer (for a pair, both answers
 * keyed by side), then runs on. Edits `state`, a working copy, in place.
 */
export function resumeStack(
  state: GameState,
  closing: Closing,
  events: GameEvent[],
  budget: Budget,
): EngineError | null {
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
 * counts once against `budget`; going over returns stepBudgetExceeded.
 */
function runStack(state: GameState, events: GameEvent[], budget: Budget): EngineError | null {
  const stack = state.public.stack;
  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    const step = frame.steps[frame.next];
    if (step === undefined) {
      finishBlock(stack, frame);
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
      return runMarker(state.public.stack, frame, step, events);
    case "if":
      return runIf(state.public.stack, frame, step);
    case "forEach":
      return runForEach(state.public.stack, frame, step);
    case "spendPoints": {
      // TEMPORARY until the actions are designed: spending points only says so. The printed ops are
      // changed by the modifiers in force now, so an event that ran just before counts (owner, 18 Oct).
      const amount = opsValue(state, { ops: step.amount }, step.side);
      events.push({ kind: "pointsSpent", visibility: "public", side: step.side, amount });
      frame.next += 1;
      return "ran";
    }
    case "modifier": {
      const source = programSource(state.public.stack);
      if (source === undefined) return problem("invalidProgram", "A modifier step needs the card it runs for.");
      startModifier(state, source, step, events);
      frame.next += 1;
      return "ran";
    }
    case "addToNumber":
      return runAddToNumber(state.public.stack, frame, step);
    case "drawContingency": {
      const value = drawContingency(state, step.side, events);
      if (step.bind !== undefined) bind(frame, step.bind, value);
      frame.next += 1;
      return "ran";
    }
  }
}

/** Emits a public marker event, with the named variable's value if the step names one. */
function runMarker(stack: Frame[], frame: Frame, step: StepOf<"marker">, events: GameEvent[]): StepOutcome {
  if (step.var === undefined) {
    events.push({ kind: "marker", visibility: "public", label: step.label });
  } else {
    const value = lookup(stack, step.var);
    if (value === undefined) return unbound(step.var);
    events.push({ kind: "marker", visibility: "public", label: step.label, value });
  }
  frame.next += 1;
  return "ran";
}

/** Pushes the branch the yes/no variable picks, unless that branch is empty. */
function runIf(stack: Frame[], frame: Frame, step: StepOf<"if">): StepOutcome {
  const value = lookup(stack, step.cond.var);
  if (value === undefined) return unbound(step.cond.var);
  const yes = step.cond.op === "yes" ? readYes(value, step.cond) : readNumberTest(value, step.cond);
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

/** The result of an atLeast, atMost or equals test on a number. */
function readNumberTest(value: VarValue, cond: Exclude<Condition, { op: "yes" }>): boolean | EngineError {
  if (typeof value !== "number") return notANumber(cond.var, cond.op);
  if (cond.op === "atLeast") return value >= cond.value;
  if (cond.op === "atMost") return value <= cond.value;
  return value === cond.value;
}

const notANumber = (name: VarName, user: string): EngineError =>
  problem("invalidProgram", `"${name}" does not hold a number, so ${user} cannot use it.`);

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
 * The yes/no a condition tests: a one-side answer as it is, or the named side's half of a both-sides
 * answer. A condition naming a side for a one-side answer, or none for a both-sides one, is an error.
 */
function readYes(value: VarValue, cond: Extract<Condition, { op: "yes" }>): boolean | EngineError {
  const notYesNo = problem("invalidProgram", `"${cond.var}" is not a yes/no answer, so if cannot test it.`);
  if (typeof value === "boolean") {
    return cond.side === undefined
      ? value
      : problem("invalidProgram", `"${cond.var}" holds one answer; the if must not name a side.`);
  }
  if (typeof value !== "object") return notYesNo;
  if (typeof value.lio !== "boolean" || typeof value.sae !== "boolean") return notYesNo;
  return cond.side === undefined
    ? problem("invalidProgram", `"${cond.var}" holds both sides' answers; the if must name a side.`)
    : value[cond.side];
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

/** The top frame's steps are done: a forEach moves to its next item, any other frame is removed. */
function finishBlock(stack: Frame[], frame: Frame): void {
  const nextItem = frame.kind === "forEach" ? frame.items[frame.index + 1] : undefined;
  if (frame.kind === "forEach" && nextItem !== undefined) {
    frame.index += 1;
    frame.next = 0;
    frame.vars = [{ name: frame.bind, value: nextItem }];
    return;
  }
  stack.pop();
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

/** The card the running program is for: its program frame's `source`, read through any if or forEach blocks. */
function programSource(stack: Frame[]): CardId | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i]!;
    if (frame.kind === "program") return frame.source;
  }
  return undefined;
}

/** Binds `name` in `frame`, replacing an earlier value with the same name. */
function bind(frame: Frame, name: VarName, value: VarValue): void {
  const found = frame.vars.find((b) => b.name === name);
  if (found) found.value = value;
  else frame.vars.push({ name, value });
}

const unbound = (name: VarName): EngineError => problem("invalidProgram", `No variable "${name}" is bound here.`);
