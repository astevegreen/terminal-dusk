// The resolution stack: runs program steps until one needs a player's choice, records that as the
// pending decision and stops. The answer resumes exactly where it stopped. A step budget per call
// stops runaway programs.
import { copyJson } from "./copy.ts";
import { newDecision } from "./decisions.ts";
import type {
  AnswerValue,
  EngineError,
  EngineErrorCode,
  Frame,
  GameEvent,
  GameState,
  Result,
  Ruleset,
  Step,
  VarName,
  VarValue,
} from "./types.ts";

const DEFAULT_STEP_BUDGET = 10_000;

/** Most steps one call may run: the ruleset's limit, else 10,000. Read on every call; never stored. */
export const stepBudget = (ruleset: Ruleset): number => ruleset.limits?.stepBudget ?? DEFAULT_STEP_BUDGET;

const problem = (code: EngineErrorCode, message: string): EngineError => ({ code, message });

/**
 * Starts `steps` as a program and runs it until it pauses or ends. If it pauses, its choice replaces
 * the pending decisions. Internal: index.ts does not export it. Engine tests start programs with it;
 * real games start them from the turn structure (#35).
 */
export function startProgram(
  ruleset: Ruleset,
  state: GameState,
  steps: Step[],
): Result<{ state: GameState; events: GameEvent[] }> {
  if (ruleset.id !== state.meta.ruleset) {
    return { ok: false, error: problem("rulesetMismatch", "That ruleset is not the one this game started with.") };
  }
  if (state.public.status.kind === "over") return { ok: false, error: problem("gameOver", "The game is over.") };
  if (state.public.stack.length > 0) {
    return { ok: false, error: problem("notSupported", "A program is already running.") };
  }
  const next = copyJson(state);
  next.meta.seq += 1;
  next.public.stack.push({ kind: "program", steps: copyJson(steps), next: 0, vars: [] });
  const events: GameEvent[] = [];
  const error = runStack(next, events, stepBudget(ruleset));
  return error ? { ok: false, error } : { ok: true, value: { state: next, events } };
}

/**
 * Resumes a paused program with a legal answer to its `choose`: binds the answer, then runs on.
 * Edits `state`, a working copy, in place.
 */
export function resumeStack(
  state: GameState,
  value: AnswerValue,
  events: GameEvent[],
  budget: number,
): EngineError | null {
  const frame = state.public.stack.at(-1);
  const step = frame?.steps[frame.next];
  if (!frame || step?.op !== "choose" || value.kind !== "yesNo") {
    return problem("invalidProgram", "The stack is not paused at a yes/no choice.");
  }
  bind(frame, step.bind, value.yes);
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
function runStack(state: GameState, events: GameEvent[], budget: number): EngineError | null {
  const stack = state.public.stack;
  let used = 0;
  while (stack.length > 0) {
    const frame = stack.at(-1)!;
    const step = frame.steps[frame.next];
    if (step === undefined) {
      finishBlock(stack, frame);
      continue;
    }
    used += 1;
    if (used > budget) return problem("stepBudgetExceeded", `More than ${budget} steps would run in one call.`);
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
      state.public.pending = [newDecision(state.meta.seq, step.who, step.decision.kind)];
      return "paused";
    case "marker":
      return runMarker(state.public.stack, frame, step, events);
    case "if":
      return runIf(state.public.stack, frame, step);
    case "forEach":
      return runForEach(state.public.stack, frame, step);
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
  if (typeof value !== "boolean") {
    return problem("invalidProgram", `"${step.cond.var}" is not a yes/no answer, so if cannot test it.`);
  }
  frame.next += 1;
  const branch = value ? step.then : (step.else ?? []);
  if (branch.length > 0) stack.push({ kind: "if", steps: branch, next: 0, vars: [] });
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
  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i]!;
    const found = frame.vars.find((b) => b.name === name);
    if (found) return found.value;
    if (frame.kind === "program") break;
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
