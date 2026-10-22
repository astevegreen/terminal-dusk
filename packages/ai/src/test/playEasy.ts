// Test helper: plays a whole game with Easy on both sides, checking every answer against the real state.
import { legalAnswers, SIDES, viewFor } from "@terminal-dusk/engine";
import type { Answer, GameEvent, Ruleset } from "@terminal-dusk/engine";
import { expect } from "vitest";
import { easyAnswer } from "../easy.ts";
import type { Weights } from "../types.ts";
import { applyTo } from "./testGames.ts";
import type { TestState } from "./testGames.ts";

/** More answers than any test game needs; past it the game is taken not to end. */
const MOST_ANSWERS = 500;

export type EasyOptions = {
  /** Names the game in the "did not end" error. */
  name?: string;
  /** Called with the milliseconds each answer took. */
  timed?: (ms: number) => void;
  /** Called after each answer with the state it answered, the state after it, the events it made and the answer. */
  applied?: (before: TestState, after: TestState, events: GameEvent[], answer: Answer) => void;
};

/**
 * Plays `state` to its end with Easy on both sides: each step a random waiting side answers, and the answer
 * must be non-null and one of the real state's legal answers. Returns the last state.
 */
export function playEasy(
  rules: Ruleset,
  start: TestState,
  weights: Weights,
  random: () => number,
  options: EasyOptions = {},
): TestState {
  let state = start;
  for (let n = 0; state.public.status.kind === "active"; n++) {
    if (n > MOST_ANSWERS) throw new Error(`${options.name ?? "the game"} did not end`);
    const before = state;
    const waiting = SIDES.filter((side) => before.public.pending.some((d) => d.side === side));
    const side = waiting[Math.floor(random() * waiting.length)]!;
    const started = Date.now();
    const value = easyAnswer(rules, viewFor(before, side), side, weights, random);
    options.timed?.(Date.now() - started);
    expect(value).not.toBeNull();
    expect(legalAnswers(rules, before, side)).toContainEqual(value);
    const decision = before.public.pending.find((d) => d.side === side)!;
    const answer: Answer = { decisionId: decision.id, side, value: value! };
    const after = applyTo(rules, before, answer);
    options.applied?.(before, after.state, after.events, answer);
    state = after.state;
  }
  return state;
}
