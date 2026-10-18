import { legalAnswers, reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";

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

  it("orders each Contingency deck as a permutation of the numbers still left in it", () => {
    for (const state of earlyStates(3)) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const guess = guessHidden(ruleset, view, side, seededRandom(4));
        for (const deck of SIDES) {
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
});
