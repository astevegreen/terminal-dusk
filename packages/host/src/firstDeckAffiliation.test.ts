import { FIRST_DECK_CARDS } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { firstDeckCardAffiliation } from "./firstDeck.ts";

describe("firstDeckCardAffiliation", () => {
  it("gives every first-deck card the affiliation its definition has", () => {
    for (const card of FIRST_DECK_CARDS) expect(firstDeckCardAffiliation(card.id), card.id).toBe(card.affiliation);
  });
  it("is undefined for an unknown card", () => {
    expect(firstDeckCardAffiliation("no-such-card")).toBeUndefined();
  });
});
