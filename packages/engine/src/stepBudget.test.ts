import { describe, expect, it } from "vitest";
import { apply, createGame } from "./index.ts";
import type { Ruleset, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  cardAnswer,
  choose,
  forEach,
  marker,
  makeSetup,
  markers,
  ruleset,
  startAtPlay,
  startWith,
  yesNoAnswer,
} from "./test/game.ts";

const budget = (stepBudget: number): Ruleset => ({ ...ruleset, limits: { stepBudget } });
const markersN = (n: number): Step[] => Array.from({ length: n }, (_, i) => marker(`m${i}`));
const items = (n: number): string[] => Array.from({ length: n }, (_, i) => `i${i}`);

describe("step budget", () => {
  it("with a budget of 10, 'choose; then 20 markers' pauses at the choice, and answering returns stepBudgetExceeded", () => {
    const tight = budget(10);
    const paused = deepFreeze(startWith([choose("go"), ...markersN(20)], tight).state);
    expect(paused.public.pending[0]?.kind).toBe("yesNo");
    const before = JSON.stringify(paused);
    const r = apply(tight, paused, yesNoAnswer(paused, true));
    expect(r).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
    expect(JSON.stringify(paused)).toBe(before);
  });
  it("with a budget of 10, 'choose; 6 markers; choose; 6 markers' plays to the end: over 10 steps in all, under 10 per apply", () => {
    const tight = budget(10);
    const program = [choose("a"), ...markersN(6), choose("b"), ...markersN(6)];
    const first = answerYesNo(startWith(program, tight).state, true, tight);
    expect(markers(first.events)).toHaveLength(6);
    const second = answerYesNo(first.state, false, tight);
    expect(markers(second.events)).toHaveLength(6);
    expect(second.state.public.stack).toEqual([]);
  });
  it("exactly the budget is allowed; one step more is not", () => {
    // After the answer: 1 forEach step + n marker steps.
    const run = (n: number) => {
      const paused = startWith([choose("go"), forEach(items(n), "x", [marker("m")])], budget(10)).state;
      return apply(budget(10), paused, yesNoAnswer(paused, true));
    };
    expect(run(9).ok).toBe(true);
    expect(run(10)).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
  });
  it("the budget defaults to 10,000 steps per call when the ruleset gives none", () => {
    const run = (n: number) => {
      const paused = startWith([choose("go"), forEach(items(n), "x", [marker("m")])]).state;
      return apply(ruleset, paused, yesNoAnswer(paused, true));
    };
    expect(run(9_999).ok).toBe(true);
    expect(run(10_000)).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
  });
  it("starting a program counts against the budget too", () => {
    const r = startProgram(budget(10), deepFreeze(startAtPlay()), markersN(11));
    expect(r).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
    expect(startProgram(budget(10), startAtPlay(), markersN(10)).ok).toBe(true);
  });
  it("the budget covers createGame: a budget too small for the opening pick returns stepBudgetExceeded", () => {
    expect(createGame(budget(0), makeSetup(), "seed-1")).toMatchObject({
      ok: false,
      error: { code: "stepBudgetExceeded" },
    });
    expect(createGame(budget(1), makeSetup(), "seed-1").ok).toBe(true);
  });
  it("one answer's budget covers both opening events together", () => {
    // l1 and s1 each run 6 markers: 12 steps from the one answer that reveals them.
    const rs = (stepBudget: number): Ruleset => ({
      ...budget(stepBudget),
      cards: ruleset.cards.map((c) => (c.id === "l1" || c.id === "s1" ? { ...c, effect: markersN(6) } : c)),
    });
    const answerBoth = (stepBudget: number) => {
      const s = createGame(rs(stepBudget), makeSetup(), "seed-1");
      if (!s.ok) throw new Error("createGame failed");
      const half = apply(rs(stepBudget), s.value.state, cardAnswer(s.value.state, "lio", "l1"));
      if (!half.ok) throw new Error("pick rejected");
      return apply(rs(stepBudget), half.value.state, cardAnswer(half.value.state, "sae", "s1"));
    };
    expect(answerBoth(12).ok).toBe(true);
    expect(answerBoth(11)).toMatchObject({ ok: false, error: { code: "stepBudgetExceeded" } });
  });
  it("the budget is never copied into the state", () => {
    const { state } = startWith([choose("go"), ...markersN(3)], budget(123));
    expect(JSON.stringify(state)).not.toContain("stepBudget");
    expect(JSON.stringify(state)).not.toContain("limits");
    expect(JSON.stringify(answerYesNo(state, true, budget(123)).state)).not.toContain("stepBudget");
  });
});
