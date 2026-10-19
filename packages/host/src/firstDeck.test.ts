import { describe, expect, it } from "vitest";
import { FIRST_DECK_NOTE, firstDeckCardName, firstDeckConfig, firstDeckRuleset } from "./firstDeck.ts";
import { hostCreate } from "./index.ts";

const byText = (a: string, b: string): number => a.localeCompare(b);

describe("the first deck as a game", () => {
  it("deals the same hands for the same seed and different hands for another", () => {
    expect(firstDeckConfig("a")).toEqual(firstDeckConfig("a"));
    expect(firstDeckConfig("a").setup.hands).not.toEqual(firstDeckConfig("b").setup.hands);
  });
  it("deals 11 cards to each side and puts the other 6 Era 1 cards in the draw pile, each card once", () => {
    const { hands, deck } = firstDeckConfig("a").setup;
    expect(hands.lio).toHaveLength(11);
    expect(hands.sae).toHaveLength(11);
    expect(deck).toHaveLength(6);
    const all = [...hands.lio, ...hands.sae, ...deck];
    expect(new Set(all).size).toBe(28);
    // Only Era 1 is dealt; later eras wait in the scenario's eras and join the draw pile on their turns.
    expect(all.sort(byText)).toEqual(
      firstDeckRuleset.cards
        .map((c) => c.id)
        .filter((id) => id.startsWith("e1-"))
        .sort(byText),
    );
  });
  it("gives each side 6 own cards, 2 rival cards and 3 neutral cards", () => {
    const { hands } = firstDeckConfig("z").setup;
    const kinds = (cards: string[]) =>
      ["lio", "sae", "neu"].map((k) => cards.filter((c) => c.includes(`-${k}-`)).length);
    expect(kinds(hands.lio)).toEqual([6, 2, 3]);
    expect(kinds(hands.sae)).toEqual([2, 6, 3]);
  });
  it("lets Era 2 enter on turn 2 with all 29 of its cards, none of them dealt into a hand", () => {
    const { eras, hands } = firstDeckConfig("a").setup;
    const era2 = eras?.find((e) => e.era === "era-2");
    expect(era2).toMatchObject({ era: "era-2", turn: 2 });
    expect(era2?.cards).toHaveLength(29);
    expect(era2?.cards.every((id) => id.startsWith("e2-"))).toBe(true);
    for (const id of era2?.cards ?? []) expect([...hands.lio, ...hands.sae]).not.toContain(id);
  });
  it("lets Era 3 enter on turn 3 with its 27 cards and the future cards on turn 4 with their 6, none dealt", () => {
    const { eras, hands } = firstDeckConfig("a").setup;
    expect(eras?.map((e) => [e.era, e.turn, e.cards.length])).toEqual([
      ["era-2", 2, 29],
      ["era-3", 3, 27],
      ["future", 4, 6],
    ]);
    expect(eras?.find((e) => e.era === "era-3")?.cards.every((id) => id.startsWith("e3-"))).toBe(true);
    expect(eras?.find((e) => e.era === "future")?.cards.every((id) => id.startsWith("ef-"))).toBe(true);
    const dealt = [...hands.lio, ...hands.sae, ...firstDeckConfig("a").setup.deck];
    for (const id of (eras ?? []).flatMap((e) => e.cards)) expect(dealt).not.toContain(id);
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
