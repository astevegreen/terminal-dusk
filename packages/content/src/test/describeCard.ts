// Test helper for the card test files: each file lists its card's cases as data, and this turns every case
// into one test that plays the real card (playCard) and checks the whole story, line for line.
import type { CardId } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playCard } from "./playCard.ts";
import type { PlayOptions } from "./playCard.ts";

/**
 * One way the card's effect can play out: the test's name, the answers and draw it uses, and the full story.
 * The story is a block of text with one story line per line, in order, as playCard tells it.
 */
export type CardCase = PlayOptions & { it: string; story: string };

/** The story block as its lines: each line trimmed, and the blank lines around the block left out. */
export function storyLines(story: string): string[] {
  return story
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** The answers behind each key of bothSidesAsked: LIO's answer first, then SAE's. */
const BOTH_ANSWERS = {
  yesYes: { lio: true, sae: true },
  yesNo: { lio: true, sae: false },
  noYes: { lio: false, sae: true },
  noNo: { lio: false, sae: false },
} as const;

const said = (yes: boolean): string => (yes ? "yes" : "no");

/**
 * The four cases of a card that asks both LIO and SAE yes or no: one story per pair of answers, keyed LIO first
 * (`yesNo` is "LIO says yes, SAE says no"). Each case is named "when LIO says yes and SAE says no" and so on, in
 * the order the keys are written.
 */
export function bothSidesAsked(stories: Readonly<Record<keyof typeof BOTH_ANSWERS, string>>): CardCase[] {
  return Object.entries(stories).map(([key, story]) => {
    const yes = BOTH_ANSWERS[key as keyof typeof BOTH_ANSWERS];
    return { it: `when LIO says ${said(yes.lio)} and SAE says ${said(yes.sae)}`, yes: { ...yes }, story };
  });
}

/** One `describe` block named "<id> <name>" with one test per case. */
export function describeCard(id: CardId, name: string, cases: readonly CardCase[]): void {
  describe(`${id} ${name}`, () => {
    for (const { it: title, story, ...options } of cases) {
      it(title, () => {
        expect(playCard(id, options)).toEqual(storyLines(story));
      });
    }
  });
}
