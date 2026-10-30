// A Hard rollout (A18, issue #507): it plays on from a candidate answer and stops where it should.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { legalAnswers, pendingFor, reconstruct, viewFor } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { guessHidden } from "./guess.ts";
import { seededRandom } from "./random.ts";
import { rollout, STEP_CAP } from "./rollout.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const rules = FIRST_DECK_RULESET;

/** A guessed state at the start of a six-region game, as LIO would rebuild it, and LIO's first legal answer. */
function opening() {
  const real = newSixRegionMapGame(5);
  const side = real.public.pending[0]!.side;
  const view = viewFor(real, side);
  const state = reconstruct(view, guessHidden(rules, view, side, seededRandom(1)));
  return { state, side, answer: legalAnswers(rules, state, side)[0]! };
}

describe("a Hard rollout", () => {
  it("with no clock, stops at its cap of 60 answers", () => {
    const { state, side, answer } = opening();
    const result = rollout(rules, state, side, answer, MEDIUM_WEIGHTS, 1000, seededRandom(2));
    expect(STEP_CAP).toBe(60);
    expect(result.steps).toBe(STEP_CAP);
    expect(Number.isFinite(result.value)).toBe(true);
  });

  it("gives the same value for the same state, answer and luck, and leaves its input as it was", () => {
    const { state, side, answer } = opening();
    const before = JSON.stringify(state);
    const first = rollout(rules, state, side, answer, MEDIUM_WEIGHTS, 2, seededRandom(4));
    expect(rollout(rules, state, side, answer, MEDIUM_WEIGHTS, 2, seededRandom(4))).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("stops once each side has played its rounds of cards, well before the cap", () => {
    const { state, side, answer } = opening();
    const result = rollout(rules, state, side, answer, MEDIUM_WEIGHTS, 1, seededRandom(4));
    expect(result.steps).toBeGreaterThan(0);
    expect(result.steps).toBeLessThan(STEP_CAP);
  });

  it("values an answer the engine refuses as worst of all", () => {
    const { state, side } = opening();
    expect(pendingFor(state, side)).not.toBeNull();
    const refused = rollout(rules, state, side, { kind: "realign", country: null }, MEDIUM_WEIGHTS, 1, seededRandom(4));
    expect(refused.value).toBe(-Infinity);
  });
});
