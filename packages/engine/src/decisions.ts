// Pending decisions: building them, finding the one a side must answer, and listing its legal answers.
import { SIDES } from "./types.ts";
import type { AnswerValue, Decision, DecisionKind, DecisionOptions, GameState, Ruleset, Side } from "./types.ts";

/**
 * What a decision of `kind` allows, said without card IDs: a yes/no has no options; the opening pick
 * is any non-neutral card in your hand; a play is any card in your hand.
 */
function optionsFor(kind: DecisionKind): DecisionOptions {
  switch (kind) {
    case "yesNo":
      return {};
    case "chooseCard":
      return { from: "hand", includeNeutral: false };
    case "playCard":
      return { from: "hand", includeNeutral: true };
  }
}

/** A new decision. Its ID comes from `seq`, which rises with every change, so IDs never repeat. */
export function newDecision(seq: number, side: Side, kind: DecisionKind): Decision {
  return { id: `d${seq}`, side, kind, options: optionsFor(kind) };
}

/** A new simultaneous group: one decision per side, in SIDES order, sharing the group `g<seq>`. */
export function newGroup(seq: number, kind: DecisionKind): Decision[] {
  return SIDES.map((side) => ({
    id: `d${seq}-${side}`,
    side,
    kind,
    options: optionsFor(kind),
    simultaneousGroup: `g${seq}`,
  }));
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
  switch (decision.kind) {
    case "yesNo":
      return [
        { kind: "yesNo", yes: true },
        { kind: "yesNo", yes: false },
      ];
    case "chooseCard":
    case "playCard": {
      const kind = decision.kind;
      return handCards(ruleset, state, side, kind === "playCard").map((card) => ({ kind, card }));
    }
  }
}

/** The cards in `side`'s hand, in hand order: all of them, or only the non-neutral ones. */
function handCards(ruleset: Ruleset, state: GameState, side: Side, includeNeutral: boolean): string[] {
  const hand = state.private[side].hand;
  if (includeNeutral) return [...hand];
  return hand.filter((id) => ruleset.cards.find((card) => card.id === id)?.affiliation !== "neutral");
}
