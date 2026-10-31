// The Hard tier (A18, issue #507): its search, its count budget and its clock, on the first deck and the test map.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { legalAnswers, viewFor } from "@terminal-dusk/engine";
import type { Decision, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hardAnswer } from "./hard.ts";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { newFirstDeckMapGame } from "./test/mapGames.ts";
import { applyTo } from "./test/testGames.ts";
import type { TestState } from "./test/testGames.ts";
import type { HardWeights } from "./types.ts";
import { HARD_WEIGHTS } from "./weights/hard.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const rules = FIRST_DECK_RULESET;
/** A small search, so each test answers in well under a second. */
const SMALL: HardWeights = { ...HARD_WEIGHTS, guesses: 3, candidates: 3, rounds: 1 };

/**
 * The first state of a seeded first-deck game on the test map, played on by Medium, where `want` holds for the
 * decision waiting first; that decision is returned with it.
 */
function reach(seed: number, want: (d: Decision) => boolean): { state: TestState; decision: Decision } {
  let state = newFirstDeckMapGame(seed);
  const random = seededRandom(seed);
  for (let n = 0; n < 500 && state.public.status.kind === "active"; n++) {
    const decision = state.public.pending[0]!;
    if (want(decision)) return { state, decision };
    const value = mediumAnswer(rules, viewFor(state, decision.side), decision.side, MEDIUM_WEIGHTS, random)!;
    state = applyTo(rules, state, { decisionId: decision.id, side: decision.side, value }).state;
  }
  throw new Error(`game ${seed} never reached the decision wanted`);
}

/** `reach` in the first of seeds 1 to 40 whose game gets there. */
function reachInSome(want: (d: Decision) => boolean): { state: TestState; decision: Decision } {
  for (let seed = 1; seed <= 40; seed++) {
    try {
      return reach(seed, want);
    } catch {
      // This game never got there; try the next.
    }
  }
  throw new Error("no game of seeds 1 to 40 reached the decision wanted");
}

/** A card choice with more answers than SMALL's candidates, so the search has something to cut. */
const cardChoice = (d: Decision): boolean => d.kind === "playCardAs";

/** A fake clock: `0` for its first `calls` readings, then always past any budget. */
function clockAfter(calls: number): () => number {
  let read = 0;
  return () => (read++ < calls ? 0 : Number.MAX_SAFE_INTEGER);
}

describe("the Hard tier", () => {
  it("gives the same answer for the same view and seed", () => {
    const { state, decision } = reach(4, cardChoice);
    const view = viewFor(state, decision.side);
    const first = hardAnswer(rules, view, decision.side, SMALL, seededRandom(3));
    expect(legalAnswers(rules, state, decision.side)).toContainEqual(first);
    expect(hardAnswer(rules, view, decision.side, SMALL, seededRandom(3))).toEqual(first);
  });

  it("gives null when nothing is pending for the side", () => {
    const { state, decision } = reach(4, cardChoice);
    const idle: Side = decision.side === "lio" ? "sae" : "lio";
    expect(state.public.pending.some((d) => d.side === idle)).toBe(false);
    expect(hardAnswer(rules, viewFor(state, idle), idle, SMALL, seededRandom(1))).toBeNull();
  });

  it("stopped by its clock after one finished guess, answers as a one-guess search does", () => {
    const { state, decision } = reach(4, cardChoice);
    expect(legalAnswers(rules, state, decision.side).length).toBeGreaterThan(SMALL.candidates);
    const view = viewFor(state, decision.side);
    // Readings: the start, before guess 1, before each of its 3 candidates; the next, before guess 2, is past time.
    const timed = hardAnswer(rules, view, decision.side, SMALL, seededRandom(8), clockAfter(2 + SMALL.candidates));
    const oneGuess = hardAnswer(rules, view, decision.side, { ...SMALL, guesses: 1 }, seededRandom(8));
    expect(legalAnswers(rules, state, decision.side)).toContainEqual(timed);
    expect(timed).toEqual(oneGuess);
  });

  it("with its clock already out, gives Medium's top answer", () => {
    for (const seed of [4, 5, 6]) {
      const { state, decision } = reach(seed, cardChoice);
      const view = viewFor(state, decision.side);
      const hard = hardAnswer(rules, view, decision.side, SMALL, seededRandom(seed), clockAfter(1));
      expect(hard).toEqual(mediumAnswer(rules, view, decision.side, SMALL, seededRandom(seed)));
    }
  });

  it("answers placeInfluence and realign as Medium does", () => {
    for (const kind of ["placeInfluence", "realign"] as const) {
      const { state, decision } = reachInSome((d) => d.kind === kind);
      const view = viewFor(state, decision.side);
      const hard = hardAnswer(rules, view, decision.side, SMALL, seededRandom(2));
      expect(hard).toEqual(mediumAnswer(rules, view, decision.side, SMALL, seededRandom(2)));
    }
  });

  it("keeps Medium's evaluation and searches the tuned size: 8 guesses, the best 4 answers, 1 round, 1.5 s", () => {
    const { guesses, candidates, rounds, timeMs, ...evaluation } = HARD_WEIGHTS;
    expect(evaluation).toEqual(MEDIUM_WEIGHTS);
    expect({ guesses, candidates, rounds, timeMs }).toEqual({ guesses: 8, candidates: 4, rounds: 1, timeMs: 1500 });
  });
});
