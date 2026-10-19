// Refilling hands (docs/design/core-loop.md, "Refilling hands"). At the start of each turn, after a new era's
// cards are shuffled in and before the opening picks, each side draws from the top of the one shared draw pile
// until its hand holds the hand size: LIO first, then SAE. When the draw pile is empty and a side still needs
// cards, the discard pile is shuffled with the game's generator to become the new draw pile.
import { shuffle } from "./rng.ts";
import { SIDES } from "./types.ts";
import type { GameEvent, GameState } from "./types.ts";

/**
 * Fills both hands up to `public.handSize`. Each draw is told only to the side that drew it; everyone else
 * hears that a card was drawn. The setup checks (cardChecks.ts) make sure the draw pile and the discards
 * always hold enough cards. Edits `state`, a working copy, in place.
 */
export function refillHands(state: GameState, events: GameEvent[]): void {
  for (const side of SIDES) {
    const hand = state.private[side].hand;
    while (hand.length < state.public.handSize) {
      if (state.secret.deck.length === 0 && !reshuffleDiscards(state, events)) return;
      const card = state.secret.deck.shift()!;
      hand.push(card);
      events.push({
        kind: "cardDrawn",
        visibility: side,
        side,
        card,
        publicForm: { kind: "cardDrawnHidden", visibility: "public", side },
      });
    }
  }
}

/** Shuffles the discard pile into a new draw pile and tells everyone how many cards it made. False if empty. */
function reshuffleDiscards(state: GameState, events: GameEvent[]): boolean {
  const cards = state.public.discard.length;
  if (cards === 0) return false;
  const shuffled = shuffle(state.secret.rng, state.public.discard);
  state.secret.deck = shuffled.items;
  state.secret.rng = shuffled.state;
  state.public.discard = [];
  events.push({ kind: "drawPileReshuffled", visibility: "public", cards });
  return true;
}
