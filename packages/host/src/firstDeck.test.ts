import { describe, expect, it } from "vitest";
import { FIRST_DECK_NOTE, firstDeckCardName, firstDeckConfig, firstDeckRuleset } from "./firstDeck.ts";
import { hostCreate } from "./index.ts";

describe("the first deck as a game", () => {
  it("deals the same hands for the same seed and different hands for another", () => {
    expect(firstDeckConfig("a")).toEqual(firstDeckConfig("a"));
    expect(firstDeckConfig("a").setup.hands).not.toEqual(firstDeckConfig("b").setup.hands);
  });
  it("deals all 34 cards once each, 17 to each side", () => {
    const { hands } = firstDeckConfig("a").setup;
    expect(hands.lio).toHaveLength(17);
    expect(hands.sae).toHaveLength(17);
    const all = [...hands.lio, ...hands.sae];
    expect(new Set(all).size).toBe(34);
    expect(all.sort()).toEqual(firstDeckRuleset.cards.map((c) => c.id).sort());
  });
  it("gives each side 9 own cards, 4 rival cards and 4 neutral cards", () => {
    const { hands } = firstDeckConfig("z").setup;
    const kinds = (cards: string[]) =>
      ["lio", "sae", "neu"].map((k) => cards.filter((c) => c.includes(`-${k}-`)).length);
    expect(kinds(hands.lio)).toEqual([9, 4, 4]);
    expect(kinds(hands.sae)).toEqual([4, 9, 4]);
  });
  it("starts a match with the engine for many seeds", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(hostCreate(firstDeckRuleset, firstDeckConfig(seed), seed, 0).ok).toBe(true);
    }
  });
  it("names its cards with real card names and labels the game as a TEST", () => {
    expect(firstDeckCardName("e1-lio-001")).not.toBe("e1-lio-001");
    expect(FIRST_DECK_NOTE).toMatch(/TEST/);
  });
});
