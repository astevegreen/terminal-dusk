import { DECKS, legalAnswers, reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";

import { describe, expect, it } from "vitest";
import { guessHidden } from "./guess.ts";
import { applyAnswer, newGame, ruleset } from "./test/testGames.ts";
import { seededRandom } from "./random.ts";
import type { TestState } from "./test/testGames.ts";

const sorted = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

/** A few states of one game: the start, and after each of the first answers. */
function earlyStates(seed: number): TestState[] {
  const states = [newGame(seed)];
  for (let n = 0; n < 6 && states.at(-1)!.public.status.kind === "active"; n++) {
    const state = states.at(-1)!;
    const side = SIDES.find((s) => state.public.pending.some((d) => d.side === s))!;
    const decision = state.public.pending.find((d) => d.side === side)!;
    const value = legalAnswers(ruleset, state, side)[0]!;
    states.push(applyAnswer(state, { decisionId: decision.id, side, value }));
  }
  return states;
}

describe("guessHidden", () => {
  it("fills the opponent's hand and the draw pile to the sizes in the view's counts", () => {
    for (const state of earlyStates(2)) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const guess = guessHidden(ruleset, view, side, seededRandom(1));
        const other = side === "lio" ? "sae" : "lio";
        expect(guess.opponent.hand).toHaveLength(view.counts.hands[other]);
        expect(guess.secret.deck).toHaveLength(view.counts.deck);
        expect(guess.opponent.picks).toEqual([]);
        expect(guess.opponent.knowledge).toEqual([]);
        expect(guess.secret.eras).toEqual([]);
      }
    }
  });

  it("never guesses a card the side can see, and never repeats one", () => {
    for (const state of earlyStates(5)) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const guess = guessHidden(ruleset, view, side, seededRandom(9));
        const seen = new Set([...state.private[side].hand, ...state.public.inPlay, ...state.public.discard]);
        const guessed = [...guess.opponent.hand, ...guess.secret.deck];
        expect(guessed.filter((id) => seen.has(id))).toEqual([]);
        expect(new Set(guessed).size).toBe(guessed.length);
      }
    }
  });

  it("orders each Contingency deck, the World deck included, as a permutation of the numbers still left in it", () => {
    for (const state of earlyStates(3)) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const guess = guessHidden(ruleset, view, side, seededRandom(4));
        for (const deck of DECKS) {
          expect(sorted(guess.secret.contingency[deck])).toEqual(view.public.contingency[deck].left);
        }
      }
    }
  });

  it("rebuilds a state with the real public part, own private part and meta", () => {
    for (const state of earlyStates(8)) {
      for (const side of SIDES) {
        const rebuilt = reconstruct(
          viewFor(state, side),
          guessHidden(ruleset, viewFor(state, side), side, seededRandom(2)),
        );
        expect(rebuilt.public).toEqual(state.public);
        expect(rebuilt.private[side]).toEqual(state.private[side]);
        expect(rebuilt.meta).toEqual(state.meta);
      }
    }
  });

  it("never deals a card in public.removed into the opponent's hand or the draw pile, over 50 seeds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = newGame(seed);
      for (const side of SIDES) {
        const other = side === "lio" ? "sae" : "lio";
        const inGame = new Set([...state.private.lio.hand, ...state.private.sae.hand, ...state.secret.deck]);
        // Cards that left the game: every ruleset card no hand or the draw pile holds, so half the pool or more.
        const removed = ruleset.cards.map((card) => card.id).filter((id) => !inGame.has(id));
        expect(removed.length).toBeGreaterThan(0);
        const real = viewFor(state, side);
        const view = { ...real, public: { ...real.public, removed } };
        const guess = guessHidden(ruleset, view, side, seededRandom(seed));
        const guessed = [...guess.opponent.hand, ...guess.secret.deck];
        expect(guessed.filter((id) => removed.includes(id))).toEqual([]);
        expect(guess.opponent.hand).toHaveLength(view.counts.hands[other]);
        expect(guess.secret.deck).toHaveLength(view.counts.deck);
      }
    }
  });

  it("gives the cannot fill error when the removed cards leave fewer unseen cards than the hidden places", () => {
    const state = newGame(4);
    const side = "lio";
    const real = viewFor(state, side);
    const hidden = real.counts.hands.sae + real.counts.deck;
    const own = new Set(state.private.lio.hand);
    // Remove all but one card fewer than the hidden places need.
    const unseen = ruleset.cards.map((card) => card.id).filter((id) => !own.has(id));
    const removed = unseen.slice(hidden - 1);
    const view = { ...real, public: { ...real.public, removed } };
    expect(() => guessHidden(ruleset, view, side, seededRandom(1))).toThrow(
      `${hidden - 1} unseen cards cannot fill ${hidden} hidden places`,
    );
  });
});
