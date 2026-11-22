// #602: Easy and Medium count Unified command's bonus when it is ready: a card played for its points is worth its
// printed ops plus the bonus, so the AI weighs a play for points above the same card's event.
import { legalAnswers, SIDES, viewFor } from "@terminal-dusk/engine";
import type { AbilityState, AnswerValue, PlayerView, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { answerOps, easyAnswer } from "./easy.ts";
import { hardAnswer } from "./hard.ts";
import { bestScored, scoredAnswers } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { applyAnswer, newGame, ruleset } from "./test/testGames.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { HARD_WEIGHTS } from "./weights/hard.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

/** A game Easy has played up to the first play of a card, and the side whose play it is. */
function atPlay(seed: number): { state: TestState; side: Side } {
  let state = newGame(seed);
  for (let step = 0; step < 20; step++) {
    const side = SIDES.find((s) => legalAnswers(ruleset, state, s).some((a) => a.kind === "playCardAs"));
    if (side !== undefined) return { state, side };
    const d = state.public.pending[0]!;
    const value = easyAnswer(ruleset, viewFor(state, d.side), d.side, EASY_WEIGHTS, seededRandom(seed))!;
    state = applyAnswer(state, { decisionId: d.id, side: d.side, value });
  }
  throw new Error(`seed ${seed}: no play of a card within 20 answers`);
}

/** `view` with `side`'s Unified command (bonus 2) ready or not, and the other side's Resilient institutions. */
function withCommand(view: PlayerView, side: Side, ready: boolean): PlayerView {
  const command: AbilityState = { id: "unifiedCommand", bonus: 2, ready, used: 0 };
  const other: AbilityState = { id: "resilientInstitutions", perTurn: 1, used: 0 };
  const abilities = side === "lio" ? { lio: command, sae: other } : { lio: other, sae: command };
  return { ...view, public: { ...view.public, abilities } };
}

const plays = (answers: readonly AnswerValue[]) =>
  answers.filter((a): a is Extract<AnswerValue, { kind: "playCardAs" }> => a.kind === "playCardAs");
const opsOf = (id: string) => ruleset.cards.find((c) => c.id === id)!.ops;
const isRival = (id: string, side: Side) => {
  const card = ruleset.cards.find((c) => c.id === id)!;
  return card.affiliation !== "neutral" && card.affiliation !== side;
};

describe("the AI and Unified command", () => {
  it("answerOps adds the bonus to a card played for its points, only while the command is ready", () => {
    const { state, side } = atPlay(1);
    const ready = withCommand(viewFor(state, side), side, true);
    const idle = withCommand(viewFor(state, side), side, false);
    const answers = plays(legalAnswers(ruleset, state, side));
    expect(answers.length).toBeGreaterThan(0);
    for (const a of answers) {
      const forPoints = a.as === "points" || isRival(a.card, side);
      expect(answerOps(ruleset, ready, side, a)).toBe(opsOf(a.card) + (forPoints ? 2 : 0));
      expect(answerOps(ruleset, idle, side, a)).toBe(opsOf(a.card));
    }
  });

  it("answerOps gives the printed ops in a game without abilities", () => {
    const { state, side } = atPlay(2);
    for (const a of plays(legalAnswers(ruleset, state, side))) {
      expect(answerOps(ruleset, viewFor(state, side), side, a)).toBe(opsOf(a.card));
    }
  });

  it("Easy with no noise plays a card for its points, not for its event, while the command is ready", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, side } = atPlay(seed);
      const view = withCommand(viewFor(state, side), side, true);
      const value = easyAnswer(ruleset, view, side, { ops: 1, rivalCard: 0, noise: 0 }, seededRandom(seed));
      expect(value?.kind).toBe("playCardAs");
      const play = value as Extract<AnswerValue, { kind: "playCardAs" }>;
      expect(play.as === "points" || isRival(play.card, side)).toBe(true);
    }
  });

  it("Medium scores each play for points the ops weight times the bonus higher, and an event the same", () => {
    const { state, side } = atPlay(3);
    const ready = scoredAnswers(
      ruleset,
      withCommand(viewFor(state, side), side, true),
      side,
      MEDIUM_WEIGHTS,
      seededRandom(9),
    )!;
    const idle = scoredAnswers(
      ruleset,
      withCommand(viewFor(state, side), side, false),
      side,
      MEDIUM_WEIGHTS,
      seededRandom(9),
    )!;
    expect(ready).toHaveLength(idle.length);
    ready.forEach(({ answer, score }, i) => {
      const forPoints = answer.kind === "playCardAs" && (answer.as === "points" || isRival(answer.card, side));
      expect(score - idle[i]!.score).toBeCloseTo(forPoints ? MEDIUM_WEIGHTS.ops * 2 : 0);
    });
  });
  it("Hard searches from Medium's scores with the bonus, and plays for points more often while the command is ready", () => {
    const one = { ...HARD_WEIGHTS, candidates: 1 };
    const small = { ...HARD_WEIGHTS, guesses: 2, candidates: 3, rounds: 1 };
    const forPoints = (value: AnswerValue | null, side: Side) =>
      value?.kind === "playCardAs" && (value.as === "points" || isRival(value.card, side));
    let readyPoints = 0;
    let idlePoints = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { state, side } = atPlay(seed);
      const ready = withCommand(viewFor(state, side), side, true);
      const idle = withCommand(viewFor(state, side), side, false);
      const best = bestScored(scoredAnswers(ruleset, ready, side, one, seededRandom(seed))!);
      expect(hardAnswer(ruleset, ready, side, one, seededRandom(seed))).toEqual(best);
      if (forPoints(hardAnswer(ruleset, ready, side, small, seededRandom(seed)), side)) readyPoints++;
      if (forPoints(hardAnswer(ruleset, idle, side, small, seededRandom(seed)), side)) idlePoints++;
    }
    expect(readyPoints).toBeGreaterThanOrEqual(idlePoints);
    expect(readyPoints).toBeGreaterThan(0);
  }, 60_000);
});
