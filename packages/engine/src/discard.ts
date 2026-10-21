// The discardFromHand step: a side discards cards from its hand, chosen at random with the game's seeded
// generator (owner, 21 Oct 2026). The cards go to the discard pile without their events. A side's own pick
// (`chosenBy`) is run in discardChoice.ts, which uses discardChosen.
import { forgetCard } from "./knowledge.ts";
import { nextInt } from "./rng.ts";
import type { CardId, GameEvent, GameState, Side } from "./types.ts";

/**
 * `side` discards `count` cards from its hand. Each one is picked with one nextInt over the cards still in
 * the hand, from `secret.rng`, which gets the generator's new state. A hand of `count` cards or fewer goes
 * whole, with no draw from the generator. The cards left keep their order; the discarded ones go to the end
 * of the discard pile in hand order, and leave the rival's knowledge. Emits cardsDiscarded, even for none.
 */
export function discardFromHand(state: GameState, side: Side, count: number, events: GameEvent[]): void {
  const hand = state.private[side].hand;
  discardChosen(state, side, hand.length <= count ? hand : pickAtRandom(state, hand, count), events);
}

/**
 * `side` discards the cards of its hand that are in `chosen`: the cards left keep their order; the discarded
 * ones go to the end of the discard pile in hand order, without their events, and leave the rival's
 * knowledge. Emits cardsDiscarded, even for none.
 */
export function discardChosen(state: GameState, side: Side, picked: readonly CardId[], events: GameEvent[]): void {
  const hand = state.private[side].hand;
  const chosen = new Set(picked);
  const discarded = hand.filter((card) => chosen.has(card));
  state.private[side].hand = hand.filter((card) => !chosen.has(card));
  for (const card of discarded) forgetCard(state, side, card);
  state.public.discard.push(...discarded);
  events.push({ kind: "cardsDiscarded", visibility: "public", side, cards: discarded });
}

/** `count` cards of `hand`, which holds more: one nextInt each over the cards not yet picked. */
function pickAtRandom(state: GameState, hand: readonly CardId[], count: number): CardId[] {
  const left = [...hand];
  const picked: CardId[] = [];
  let rng = state.secret.rng;
  for (let i = 0; i < count; i++) {
    const drawn = nextInt(rng, left.length);
    rng = drawn.state;
    picked.push(left.splice(drawn.value, 1)[0]!);
  }
  state.secret.rng = rng;
  return picked;
}
