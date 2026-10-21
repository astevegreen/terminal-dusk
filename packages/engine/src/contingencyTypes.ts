// The Contingency decks' types (docs/design/contingency-deck.md): LIO's, SAE's and the shared World deck.
// types.ts re-exports them, so index.ts exports the same names.
import type { Side } from "./types.ts";

/** A Contingency deck: a side's own, or the World deck, which belongs to neither side. */
export type DeckId = Side | "world";
/** All three decks, in the one order the engine always loops in: LIO's, SAE's, then the World deck. */
export const DECKS: readonly DeckId[] = ["lio", "sae", "world"];

/**
 * One Contingency deck's public side: `cards` is its full contents, sorted ascending, and never changes
 * (a reshuffle rebuilds the deck from it); `left` is the numbers still in the deck, sorted ascending.
 */
export type ContingencyDeck = { cards: number[]; left: number[] };

/** A contingency was drawn: the top card of `deck`, numbered `value`. */
export type ContingencyDrawn = { kind: "contingencyDrawn"; visibility: "public"; deck: DeckId; value: number };
/** A draw left two cards in `deck`, so all its cards were shuffled back together. */
export type ContingencyDeckReshuffled = { kind: "contingencyDeckReshuffled"; visibility: "public"; deck: DeckId };
