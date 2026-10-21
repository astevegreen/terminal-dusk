// The events of the steps that look at or take from a hand: revealHand (knowledge.ts) and discardFromHand
// (discard.ts). types.ts re-exports them, so index.ts exports the same names.
import type { CardId, Side } from "./types.ts";

/** Everyone else's version of a shown hand: whose hand was shown and how many cards, never which. */
export type HandRevealedHidden = { kind: "handRevealedHidden"; visibility: "public"; side: Side; cards: number };
/**
 * `side`'s hand was shown to the other side, the peeking side (`visibility`): `cards` is the whole hand,
 * in hand order. Only the peeking side sees it; the shown side and spectators get `publicForm`.
 */
export type HandRevealed = {
  kind: "handRevealed";
  visibility: Side;
  side: Side;
  cards: CardId[];
  publicForm: HandRevealedHidden;
};
/**
 * `side` discarded `cards` from its hand to the discard pile, in hand order, without their events. Public,
 * because the discard pile is in the public compartment (docs/architecture.md, Decision 2): every viewer
 * sees these cards there anyway. Empty when the hand was empty.
 */
export type CardsDiscarded = { kind: "cardsDiscarded"; visibility: "public"; side: Side; cards: CardId[] };
