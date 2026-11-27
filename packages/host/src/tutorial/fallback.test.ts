import type { AnswerValue } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { neverStuck } from "./fallback.ts";
import type { TutorialOutput } from "./runner.ts";

const output = (allows: (answer: AnswerValue) => boolean): TutorialOutput =>
  ({
    coaching: "Play a card.",
    chapter: null,
    style: "coach",
    allows,
    coachingOver: false,
  }) as unknown as TutorialOutput;
const play = (card: string): AnswerValue => ({ kind: "playCard", card, as: "ops" }) as unknown as AnswerValue;

describe("neverStuck (#641)", () => {
  it("keeps the step's limits when at least one legal answer passes them", () => {
    const step = output((a) => JSON.stringify(a) === JSON.stringify(play("c1")));
    const result = neverStuck(step, [play("c1"), play("c2")]);
    expect(result).toBe(step);
    expect(result.allows(play("c2"))).toBe(false);
  });

  it("allows every answer when the step refuses every legal answer, so the learner is never stuck", () => {
    const step = output(() => false);
    const result = neverStuck(step, [play("c1"), play("c2")]);
    expect(result.allows(play("c1"))).toBe(true);
    expect(result.allows(play("c2"))).toBe(true);
    expect(result.coaching).toBe("Play a card.");
    expect(step.allows(play("c1")), "the input is not changed").toBe(false);
  });

  it("leaves the step alone when nothing waits for the learner (no legal answers)", () => {
    const step = output(() => false);
    expect(neverStuck(step, [])).toBe(step);
  });
});
