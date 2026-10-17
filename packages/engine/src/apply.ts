// Takes one answer and returns the next state. Illegal answers return a typed error and never throw.
//
// PLACEHOLDER GAME: the sides take turns answering "pass" for `rounds` rounds. The turn-structure
// task (#35) replaces `advancePlaceholder` with the real turn structure.
import { legalAnswers, newPassDecision } from "./decisions.ts";
import { SIDES } from "./types.ts";
import type { Answer, EngineErrorCode, GameEvent, GameState, Result, Ruleset, Side } from "./types.ts";

type Applied = Result<{ state: GameState; events: GameEvent[] }>;

const fail = (code: EngineErrorCode, message: string): Applied => ({ ok: false, error: { code, message } });
/** State is plain JSON, so a JSON round trip is a complete copy. */
const copyState = (state: GameState): GameState => JSON.parse(JSON.stringify(state)) as GameState;
const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

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
  if (!decision) return fail("unknownDecision", "No open decision has that ID.");
  if (decision.side !== answer.side) return fail("wrongSide", "That decision belongs to the other side.");
  const legal = legalAnswers(ruleset, state, answer.side);
  if (!legal.some((v) => JSON.stringify(v) === JSON.stringify(answer.value))) {
    return fail("illegalAnswer", "That answer is not one of the legal answers.");
  }
  const next = copyState(state);
  next.meta.seq += 1;
  advancePlaceholder(next, answer.side);
  return { ok: true, value: { state: next, events: [] } };
}

function applySystem(state: GameState, answer: Extract<Answer, { system: string }>): Applied {
  if (answer.system !== "resign") {
    return fail("notSupported", `The ${String(answer.system)} answer is not supported yet.`);
  }
  const next = copyState(state);
  next.meta.seq += 1;
  next.public.pending = [];
  next.public.status = { kind: "over", winner: other(answer.side), reason: "resigned" };
  return { ok: true, value: { state: next, events: [] } };
}

/**
 * Placeholder turn order: LIO answers first, then the sides alternate; `turn` rises after each pair.
 * The game ends when `turn` passes `rounds`, which is after rounds x 2 answers.
 */
function advancePlaceholder(next: GameState, answered: Side): void {
  if (answered === "sae") next.public.turn += 1;
  if (next.public.turn > next.public.rounds) {
    next.public.pending = [];
    next.public.status = { kind: "over", winner: null, reason: "placeholderFinished" };
    return;
  }
  next.public.pending = [newPassDecision(next.meta.seq, other(answered))];
}
