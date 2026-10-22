// Takes one answer and returns the next state. Illegal answers return a typed error and never throw.
//
// An answer to one of a simultaneous pair is kept secret until the other side's is in (simultaneous.ts).
// An answer to a paused program resumes the resolution stack (stack.ts). Once the stack is empty, the
// turn structure moves the game on (turn.ts).
import { copyJson } from "./copy.ts";
import { legalAnswers, pendingFor } from "./decisions.ts";
import { recordPick } from "./simultaneous.ts";
import { newBudget, resumeStack } from "./stack.ts";
import type { Closing } from "./stack.ts";
import { afterAnswer } from "./turn.ts";
import { otherSide, SIDES } from "./types.ts";
import type { Answer, EngineErrorCode, GameEvent, GameState, Result, Ruleset } from "./types.ts";

type Applied = Result<{ state: GameState; events: GameEvent[] }>;

const fail = (code: EngineErrorCode, message: string): Applied => ({ ok: false, error: { code, message } });

/** JSON with object keys sorted, so equal values match whatever order their keys arrived in. */
const canonical = (value: unknown): string | undefined =>
  JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) // keys are never equal
      : v,
  );

export function apply(ruleset: Ruleset, state: GameState, answer: Answer): Applied {
  if (ruleset.id !== state.meta.ruleset) {
    return fail("rulesetMismatch", "That ruleset is not the one this game started with.");
  }
  if (state.public.status.kind === "over") return fail("gameOver", "The game is already over.");
  if (typeof answer !== "object" || answer === null || !SIDES.includes(answer.side)) {
    return fail("unknownDecision", "The answer does not name a side.");
  }
  if ("system" in answer) return applySystem(state, answer);

  const decision = state.public.pending.find((d) => d.id === answer.decisionId);
  if (!decision) {
    return state.private[answer.side].picks.some((p) => p.decisionId === answer.decisionId)
      ? fail("alreadyAnswered", "That side has already answered this simultaneous choice.")
      : fail("unknownDecision", "No open decision has that ID.");
  }
  if (decision.side !== answer.side) return fail("wrongSide", "That decision belongs to the other side.");
  const given = canonical(answer.value);
  const value = legalAnswers(ruleset, state, answer.side).find((v) => canonical(v) === given);
  if (!value) return fail("illegalAnswer", "That answer is not one of the legal answers.");

  const next = copyJson(state);
  next.meta.seq += 1;
  const events: GameEvent[] = [];
  let closing: Closing = { who: answer.side, value };
  if (decision.simultaneousGroup !== undefined) {
    const revealed = recordPick(next, decision, decision.simultaneousGroup, value);
    if (!revealed) return { ok: true, value: { state: next, events } };
    closing = { who: "both", values: revealed };
  }
  // One budget for everything this answer runs: the paused program, then any events after it.
  const budget = newBudget(ruleset);
  if (next.public.stack.length > 0) {
    const error = resumeStack(next, closing, events, budget);
    if (error) return { ok: false, error };
    if (next.public.stack.length > 0) return { ok: true, value: { state: next, events } };
  }
  const error = afterAnswer(ruleset, next, closing, events, budget);
  return error ? { ok: false, error } : { ok: true, value: { state: next, events } };
}

// Resign and timeout both end the game at once: the other side wins, and nothing is left open.
// A timeout is the host's deadline job saying `side` was late, so `side` must be the one being waited for.
function applySystem(state: GameState, answer: Extract<Answer, { system: string }>): Applied {
  let reason: string;
  if (answer.system === "resign") reason = "resigned";
  else if (answer.system === "timeout") {
    if (!pendingFor(state, answer.side)) return fail("wrongSide", "The game is not waiting for that side.");
    reason = "timeout";
  } else return fail("notSupported", `The ${String(answer.system)} answer is not supported yet.`);
  const next = copyJson(state);
  next.meta.seq += 1;
  next.public.pending = [];
  next.public.stack = [];
  for (const side of SIDES) next.private[side].picks = [];
  next.public.status = { kind: "over", winner: otherSide(answer.side), reason };
  return { ok: true, value: { state: next, events: [] } };
}
