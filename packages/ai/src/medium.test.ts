// The Medium tier (A16, issue #455): whole seeded games on the test map and the six-region map.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { legalAnswers, SIDES, viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, Ruleset } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { escalationRuleset, newFirstDeckMapGame, newMapGame, newSixRegionMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import { applyAnswer, applyTo, newGame, ruleset } from "./test/testGames.ts";
import type { TestState } from "./test/testGames.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

/** The slowest answer allowed, in milliseconds (Decision 8). */
const SLOWEST_MS = 500;

/** Plays `start` to its end with Medium on both sides: the last state and the slowest answer. */
function playMedium(rules: Ruleset, start: TestState, name: string) {
  const times: number[] = [];
  const final = playEasy(rules, start, MEDIUM_WEIGHTS, seededRandom(9), {
    name,
    answerWith: mediumAnswer,
    timed: (ms) => times.push(ms),
  });
  return { final, slowest: Math.max(...times) };
}

describe("the Medium tier", () => {
  it("has the Easy terms and a positive weight for each new term, as data", () => {
    expect(MEDIUM_WEIGHTS.ops).toBeGreaterThan(0);
    expect(MEDIUM_WEIGHTS.noise).toBeGreaterThan(0);
    for (const key of ["region", "progress", "battleground", "closed", "crisis", "trap"] as const) {
      expect(MEDIUM_WEIGHTS[key]).toBeGreaterThan(0);
    }
  });

  it("gives the same answer for the same view and the same random sequence", () => {
    const view = viewFor(newMapGame(7), "lio");
    const first = mediumAnswer(escalationRuleset, view, "lio", MEDIUM_WEIGHTS, seededRandom(5));
    expect(first).not.toBeNull();
    expect(mediumAnswer(escalationRuleset, view, "lio", MEDIUM_WEIGHTS, seededRandom(5))).toEqual(first);
  });

  it("gives null when nothing is pending for the side", () => {
    let state = newGame(3);
    for (const side of SIDES) {
      const d = state.public.pending.find((p) => p.side === side)!;
      const value = mediumAnswer(ruleset, viewFor(state, side), side, MEDIUM_WEIGHTS, seededRandom(1))!;
      state = applyAnswer(state, { decisionId: d.id, side, value });
    }
    const idle = SIDES.filter((side) => !state.public.pending.some((d) => d.side === side));
    expect(idle.length).toBeGreaterThan(0);
    for (const side of idle) {
      expect(mediumAnswer(ruleset, viewFor(state, side), side, MEDIUM_WEIGHTS, seededRandom(1))).toBeNull();
    }
  });

  it("only gives legal answers", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = newMapGame(seed);
      for (const side of SIDES) {
        const value = mediumAnswer(escalationRuleset, viewFor(state, side), side, MEDIUM_WEIGHTS, seededRandom(seed));
        expect(legalAnswers(escalationRuleset, state, side)).toContainEqual(value);
      }
    }
  });

  it("plays whole games on the test map: every answer legal, every game ends, each answer inside the time limit", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { final, slowest } = playMedium(escalationRuleset, newMapGame(seed), `test map game ${seed}`);
      expect(final.public.status.kind).toBe("over");
      expect(slowest).toBeLessThan(SLOWEST_MS);
    }
  });

  it("plays whole games with the real first deck on the test map and the six-region map", () => {
    const starts = [newFirstDeckMapGame(1), newSixRegionMapGame(1), newSixRegionMapGame(2)];
    starts.forEach((start, i) => {
      const { final, slowest } = playMedium(FIRST_DECK_RULESET, start, `first-deck game ${i}`);
      expect(final.public.status.kind).toBe("over");
      expect(slowest).toBeLessThan(SLOWEST_MS);
    });
  });

  it("does not open with a card that raises Escalation to 6 when Escalation is at 5 and a safe card is in hand", () => {
    const base = viewFor(newMapGame(2), "lio");
    const view = { ...base, public: { ...base.public, escalation: 5 } };
    const hand = base.mine?.hand ?? [];
    const raises = (id: string) =>
      JSON.stringify(escalationRuleset.cards.find((c) => c.id === id)!.effect).includes('"by":');
    const risky = (id: string) =>
      /"by":[1-9]/.test(JSON.stringify(escalationRuleset.cards.find((c) => c.id === id)!.effect));
    expect(hand.some((id) => !risky(id))).toBe(true);
    expect(hand.some(raises)).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const answer = mediumAnswer(escalationRuleset, view, "lio", MEDIUM_WEIGHTS, seededRandom(seed));
      if (answer?.kind === "chooseCard") expect(risky(answer.card)).toBe(false);
    }
  });

  it("does not pick an action menu answer that raises Escalation to 6 when another answer is safe", () => {
    let checked = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const menus: TestState[] = [];
      playEasy(escalationRuleset, newMapGame(seed), MEDIUM_WEIGHTS, seededRandom(seed), {
        applied: (before) => {
          if (before.public.pending.some((d) => d.kind === "chooseAction")) menus.push(before);
        },
      });
      for (const menu of menus) {
        const decision = menu.public.pending.find((d) => d.kind === "chooseAction")!;
        const state = { ...menu, public: { ...menu.public, escalation: 5 } };
        const causes = (value: AnswerValue): boolean =>
          applyTo(escalationRuleset, state, { decisionId: decision.id, side: decision.side, value }).events.some(
            (e) => e.kind === "escalationCrisis" && e.side === decision.side,
          );
        const legal = legalAnswers(escalationRuleset, state, decision.side);
        if (!legal.some(causes) || legal.every(causes)) continue;
        checked++;
        const answer = mediumAnswer(
          escalationRuleset,
          viewFor(state, decision.side),
          decision.side,
          MEDIUM_WEIGHTS,
          seededRandom(seed),
        )!;
        expect(causes(answer)).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
