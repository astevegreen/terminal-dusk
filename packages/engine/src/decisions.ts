// Pending decisions: building them, finding the one a side must answer, and listing its legal answers.
import type { AnswerValue, Decision, GameState, Ruleset, Side } from "./types.ts";

/** A "pass" decision. Its ID comes from `seq`, which rises with every accepted answer, so IDs never repeat. */
export function newPassDecision(seq: number, side: Side): Decision {
  return { id: `d${seq}`, side, kind: "pass", options: {} };
}

/** The decision `side` must answer, or null. */
export function pendingFor(state: GameState, side: Side): Decision | null {
  return state.public.pending.find((d) => d.side === side) ?? null;
}

/** The finite list of answers `side` may give. Empty if nothing is pending or the ruleset is not the game's. */
export function legalAnswers(ruleset: Ruleset, state: GameState, side: Side): AnswerValue[] {
  if (ruleset.id !== state.meta.ruleset) return [];
  const decision = pendingFor(state, side);
  if (!decision) return [];
  return expandOptions(decision);
}

function expandOptions(decision: Decision): AnswerValue[] {
  switch (decision.kind) {
    case "pass":
      return [{ kind: "pass" }];
  }
}
