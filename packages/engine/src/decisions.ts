// Pending decisions: building them, finding the one a side must answer, and listing its legal answers.
import { SIDES } from "./types.ts";
import type { AnswerValue, Decision, DecisionKind, GameState, Ruleset, Side } from "./types.ts";

/** A new decision. Its ID comes from `seq`, which rises with every change, so IDs never repeat. */
export function newDecision(seq: number, side: Side, kind: DecisionKind): Decision {
  return { id: `d${seq}`, side, kind, options: {} };
}

/** A new simultaneous group: one decision per side, in SIDES order, sharing the group `g<seq>`. */
export function newGroup(seq: number, kind: DecisionKind): Decision[] {
  return SIDES.map((side) => ({ id: `d${seq}-${side}`, side, kind, options: {}, simultaneousGroup: `g${seq}` }));
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
    case "yesNo":
      return [
        { kind: "yesNo", yes: true },
        { kind: "yesNo", yes: false },
      ];
  }
}
