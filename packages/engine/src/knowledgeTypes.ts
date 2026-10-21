// The events of a revealHand step (knowledge.ts). types.ts re-exports them, so index.ts exports the same names.
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
