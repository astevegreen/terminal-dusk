import { legalAnswers, SIDES, viewFor } from "@terminal-dusk/engine";
import type { Answer, AnswerValue } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { applyAnswer, newGame, ruleset } from "./test/testGames.ts";
import { seededRandom } from "./random.ts";
import type { TestState } from "./test/testGames.ts";
import type { Weights } from "./types.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const MOST_ANSWERS = 500;

/** Plays a whole game with Easy on both sides, checking every answer against the real state. */
function playEasy(state: TestState, weights: Weights, random: () => number, each?: (ms: number) => void): TestState {
  for (let n = 0; state.public.status.kind === "active"; n++) {
    if (n > MOST_ANSWERS) throw new Error("the game did not end");
    const waiting = SIDES.filter((side) => state.public.pending.some((d) => d.side === side));
    const side = waiting[Math.floor(random() * waiting.length)]!;
    const started = Date.now();
    const value = easyAnswer(ruleset, viewFor(state, side), side, weights, random);
    each?.(Date.now() - started);
    expect(value).not.toBeNull();
    expect(legalAnswers(ruleset, state, side)).toContainEqual(value);
    const decision = state.public.pending.find((d) => d.side === side)!;
    state = applyAnswer(state, { decisionId: decision.id, side, value: value! } satisfies Answer);
  }
  return state;
}

describe("the Easy tier", () => {
  it("has positive ops and noise weights, as data", () => {
    expect(EASY_WEIGHTS.ops).toBeGreaterThan(0);
    expect(EASY_WEIGHTS.noise).toBeGreaterThan(0);
  });

  it("plays 100 seeded games on both sides with only legal answers, and every game ends", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const final = playEasy(newGame(seed), EASY_WEIGHTS, seededRandom(seed));
      expect(final.public.status.kind).toBe("over");
    }
  });

  it("gives the same answer for the same view and the same random sequence", () => {
    const state = newGame(7);
    const view = viewFor(state, "lio");
    const first = easyAnswer(ruleset, view, "lio", EASY_WEIGHTS, seededRandom(5));
    const second = easyAnswer(ruleset, view, "lio", EASY_WEIGHTS, seededRandom(5));
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
  });

  it("gives null when nothing is pending for the side", () => {
    let state = newGame(3);
    // Both sides answer the opening pick; then only the side to play is waiting.
    for (const side of SIDES) {
      const d = state.public.pending.find((p) => p.side === side)!;
      const value = easyAnswer(ruleset, viewFor(state, side), side, EASY_WEIGHTS, seededRandom(1))!;
      state = applyAnswer(state, { decisionId: d.id, side, value });
    }
    const idle = SIDES.filter((side) => !state.public.pending.some((d) => d.side === side));
    expect(idle.length).toBeGreaterThan(0);
    for (const side of idle) {
      expect(easyAnswer(ruleset, viewFor(state, side), side, EASY_WEIGHTS, seededRandom(1))).toBeNull();
    }
  });

  it("with no noise and positive ops, the opening pick is the highest-ops legal card", () => {
    const weights: Weights = { ops: 1, rivalCard: 0, noise: 0 };
    for (let seed = 1; seed <= 20; seed++) {
      const state = newGame(seed);
      for (const side of SIDES) {
        const value = easyAnswer(ruleset, viewFor(state, side), side, weights, seededRandom(seed));
        const opsOf = (answer: AnswerValue): number =>
          answer.kind === "chooseCard" ? ruleset.cards.find((c) => c.id === answer.card)!.ops : 0;
        const best = Math.max(...legalAnswers(ruleset, state, side).map(opsOf));
        expect(value?.kind).toBe("chooseCard");
        expect(opsOf(value!)).toBe(best);
      }
    }
  });

  it("with a very negative rivalCard weight, a play avoids the rival's card when an own card is legal", () => {
    const weights: Weights = { ops: 1, rivalCard: -1000, noise: 0 };
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let state = newGame(seed);
      while (state.public.status.kind === "active") {
        const side = SIDES.find((s) => state.public.pending.some((d) => d.side === s))!;
        const decision = state.public.pending.find((d) => d.side === side)!;
        const legal = legalAnswers(ruleset, state, side);
        const value = easyAnswer(ruleset, viewFor(state, side), side, weights, seededRandom(seed))!;
        if (decision.kind === "playCardAs") {
          const affiliation = (answer: AnswerValue): string =>
            answer.kind === "playCardAs" ? ruleset.cards.find((c) => c.id === answer.card)!.affiliation : "";
          if (legal.some((a) => affiliation(a) === side)) {
            expect(affiliation(value)).not.toBe(side === "lio" ? "sae" : "lio");
            checked++;
          }
        }
        state = applyAnswer(state, { decisionId: decision.id, side, value });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("answers every decision of a 10-turn game in under 200 ms", () => {
    const slowest: number[] = [];
    const final = playEasy(newGame(11, 10), EASY_WEIGHTS, seededRandom(11), (ms) => slowest.push(ms));
    expect(final.public.status.kind).toBe("over");
    expect(slowest.length).toBeGreaterThan(20);
    expect(Math.max(...slowest)).toBeLessThan(200);
  });
});
