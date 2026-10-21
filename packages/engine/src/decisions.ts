// Pending decisions: building them, finding the one a side must answer, and listing its legal answers.
import { otherSide, SIDES } from "./types.ts";
import type {
  AnswerValue,
  CardDef,
  CardId,
  Decision,
  DecisionKind,
  DecisionOptions,
  GameState,
  PlayUse,
  PlayUses,
  Ruleset,
  Side,
} from "./types.ts";

/**
 * The uses a play allows (docs/design/core-loop.md, "Playing a card"): your own card or a neutral card
 * for its event or its points; a rival's card for its points only (its event still happens, see turn.ts).
 * A neutral card played for its points has no event.
 */
const playUses = (): PlayUses => ({ own: ["event", "points"], rival: ["points"], neutral: ["event", "points"] });

/** Whose card `card` is, seen from `side`. */
export function whoseCard(card: CardDef | undefined, side: Side): keyof PlayUses {
  if (card === undefined || card.affiliation === "neutral") return "neutral";
  return card.affiliation === side ? "own" : "rival";
}

/** The kinds of decision whose options follow from the kind alone: all but a discard pick (newDiscardDecision). */
type PlainKind = Exclude<DecisionKind, "discardCards">;

/**
 * What a decision of `kind` allows, said without card IDs: a yes/no or a rivalEventOrder has no
 * options; the opening pick is any card in your hand, neutral ones too; a play is any card in your hand,
 * used as its kind of card allows.
 */
function optionsFor(kind: PlainKind): DecisionOptions {
  switch (kind) {
    case "yesNo":
    case "rivalEventOrder":
      return {};
    case "chooseCard":
      return { from: "hand" };
    case "playCardAs":
      return { from: "hand", uses: playUses() };
  }
}

/** A new decision. Its ID comes from `seq`, which rises with every change, so IDs never repeat. */
export function newDecision(seq: number, side: Side, kind: PlainKind): Decision {
  return { id: `d${seq}`, side, kind, options: optionsFor(kind) };
}

/**
 * A new discard pick: `side` picks `count` cards to discard from its own hand ("hand") or the rival's
 * ("rivalHand"). Its ID comes from `seq`, as for newDecision. The options never list the cards.
 */
export function newDiscardDecision(seq: number, side: Side, from: "hand" | "rivalHand", count: number): Decision {
  return { id: `d${seq}`, side, kind: "discardCards", options: { from, count } };
}

/** A new simultaneous group: one decision per side, in SIDES order, sharing the group `g<seq>`. */
export function newGroup(seq: number, kind: PlainKind): Decision[] {
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
    case "rivalEventOrder":
      return [
        { kind: "rivalEventOrder", event: "before" },
        { kind: "rivalEventOrder", event: "after" },
      ];
    case "chooseCard":
      return state.private[side].hand.map((card) => ({ kind: "chooseCard", card }));
    case "playCardAs": {
      const uses = playUses();
      return state.private[side].hand.flatMap((card) =>
        uses[whoseCard(cardOf(ruleset, card), side)].map((as: PlayUse) => ({ kind: "playCardAs" as const, card, as })),
      );
    }
    case "discardCards": {
      const { options } = decision;
      if (!("count" in options)) return [];
      const hand = state.private[options.from === "hand" ? side : otherSide(side)].hand;
      return setsOf(hand, options.count).map((cards) => ({ kind: "discardCards", cards }));
    }
  }
}

/**
 * Every set of `count` different cards from `cards`, each set in the list's order, the sets in order of
 * position (the first card's place, then the second's, and so on).
 */
function setsOf(cards: readonly CardId[], count: number): CardId[][] {
  if (count === 0) return [[]];
  return cards.flatMap((card, i) => setsOf(cards.slice(i + 1), count - 1).map((rest) => [card, ...rest]));
}

const cardOf = (ruleset: Ruleset, id: string): CardDef | undefined => ruleset.cards.find((card) => card.id === id);
