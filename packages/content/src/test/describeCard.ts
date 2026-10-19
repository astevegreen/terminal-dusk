// Test helper for the card test files: each file lists its card's cases as data, and this turns every case
// into one test that plays the real card (playCard) and checks the whole story, line for line.
import type { CardId } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playCard } from "./playCard.ts";
import type { PlayOptions } from "./playCard.ts";

/** One way the card's effect can play out: the test's name, the answers and draw it uses, and the full story. */
export type CardCase = PlayOptions & { it: string; story: readonly string[] };

/** One `describe` block named "<id> <name>" with one test per case. */
export function describeCard(id: CardId, name: string, cases: readonly CardCase[]): void {
  describe(`${id} ${name}`, () => {
    for (const { it: title, story, ...options } of cases) {
      it(title, () => {
        expect(playCard(id, options)).toEqual(story);
      });
    }
  });
}
