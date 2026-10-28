import { FIRST_DECK_CARDS } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { firstDeckCardRules } from "./firstDeck.ts";

describe("firstDeckCardRules", () => {
  it("returns a card's rules text as its card file has it", () => {
    expect(firstDeckCardRules("e1-lio-001")).toBe(
      'Record "union founded" for the rest of the game. LIO spends 1 point on actions. Until the end of this turn, each time LIO spends points, it spends 1 more.',
    );
  });
  it("returns undefined for an unknown card", () => {
    expect(firstDeckCardRules("no-such-card")).toBeUndefined();
  });
  it("gives every first-deck card its own rules text", () => {
    expect(FIRST_DECK_CARDS.length).toBeGreaterThan(0);
    for (const card of FIRST_DECK_CARDS) expect(firstDeckCardRules(card.id), card.id).toBe(card.text.rules);
  });
});
