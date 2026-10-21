// Property test (#186): for random hands, counts and generator states, a discardFromHand takes exactly
// min(count, hand size) distinct cards from the hand, all of them in it, puts exactly those at the end of the
// discard pile, and never changes how many cards are in the game.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { copyJson } from "./copy.ts";
import { startAtPlay, startWith } from "./test/game.ts";
import type { CardId, GameState, Side } from "./types.ts";

/** Every card in the game: both hands, the draw pile, the discard pile, the cards in play and later eras. */
const allCards = (s: GameState): CardId[] => [
  ...s.private.lio.hand,
  ...s.private.sae.hand,
  ...s.secret.deck,
  ...s.public.discard,
  ...s.public.inPlay,
  ...s.secret.eras.flatMap((e) => e.cards),
];

const uint32 = fc.integer({ min: 0, max: 4294967295 });

describe("discardFromHand: the cards leave the hand for the discard pile, none lost or made", () => {
  it("exactly min(count, hand size) distinct cards of the hand go to the end of the discard pile", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Side>("lio", "sae"),
        fc.integer({ min: 0, max: 7 }),
        fc.integer({ min: 1, max: 9 }),
        fc.tuple(uint32, uint32, uint32, uint32),
        (side, size, count, rng) => {
          // A random hand of `size` cards: the side's own, topped up from the draw pile, the rest discarded.
          const base = copyJson(startAtPlay());
          const pool = [...base.private[side].hand, ...base.secret.deck];
          base.private[side].hand = pool.slice(0, size);
          base.secret.deck = [];
          base.public.discard.push(...pool.slice(size));
          base.secret.rng = rng;
          const hand = base.private[side].hand;

          const { state } = startWith([{ op: "discardFromHand", side, count }], undefined, base);
          const left = state.private[side].hand;
          const gone = hand.filter((card) => !left.includes(card));
          expect(gone).toHaveLength(Math.min(count, hand.length));
          expect(new Set(gone).size).toBe(gone.length);
          for (const card of left) expect(hand).toContain(card);
          expect(left).toEqual(hand.filter((card) => !gone.includes(card)));
          expect(state.public.discard).toEqual([...base.public.discard, ...gone]);
          expect(allCards(state).sort()).toEqual(allCards(base).sort());
        },
      ),
    );
  });
});
