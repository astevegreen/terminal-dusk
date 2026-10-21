// Knowledge: the rival's cards a side has been shown (docs/architecture.md, section 3), kept in that side's
// own private compartment while they stay in the rival's hand. A revealHand step adds to it; a card leaves
// it as soon as it leaves the rival's hand, so it is always part of the rival's current hand.
import { copyJson } from "./copy.ts";
import { otherSide } from "./types.ts";
import type { CardId, GameEvent, GameState, Side } from "./types.ts";

/**
 * Shows `side`'s whole hand to the other side: every card in it joins the other side's knowledge, the
 * ones already known keeping their place and the new ones added at the end, in hand order. The hand
 * itself is untouched. Emits handRevealed for the peeking side, even for an empty hand.
 */
export function revealHand(state: GameState, side: Side, events: GameEvent[]): void {
  const peeker = otherSide(side);
  const hand = state.private[side].hand;
  const known = state.private[peeker].knowledge;
  for (const card of hand) if (!known.includes(card)) known.push(card);
  events.push({
    kind: "handRevealed",
    visibility: peeker,
    side,
    cards: copyJson(hand),
    publicForm: { kind: "handRevealedHidden", visibility: "public", side, cards: hand.length },
  });
}

/** `card` has left `side`'s hand, so the other side no longer knows it is there. */
export function forgetCard(state: GameState, side: Side, card: CardId): void {
  const rival = state.private[otherSide(side)];
  rival.knowledge = rival.knowledge.filter((id) => id !== card);
}
