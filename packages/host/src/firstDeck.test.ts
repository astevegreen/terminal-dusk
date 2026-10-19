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
    // Only Era 1 is dealt; later eras wait in the scenario's eras and join the draw pile on their turns.
    expect(all.sort()).toEqual(
      firstDeckRuleset.cards
        .map((c) => c.id)
        .filter((id) => id.startsWith("e1-"))
        .sort(),
    );
  });
  it("gives each side 9 own cards, 4 rival cards and 4 neutral cards", () => {
    const { hands } = firstDeckConfig("z").setup;
    const kinds = (cards: string[]) =>
      ["lio", "sae", "neu"].map((k) => cards.filter((c) => c.includes(`-${k}-`)).length);
    expect(kinds(hands.lio)).toEqual([9, 4, 4]);
    expect(kinds(hands.sae)).toEqual([4, 9, 4]);
  });
  it("lets Era 2 enter on turn 3 with all 34 of its cards, none of them dealt into a hand", () => {
    const { eras, hands } = firstDeckConfig("a").setup;
    const era2 = eras?.find((e) => e.era === "era-2");
    expect(era2).toMatchObject({ era: "era-2", turn: 3 });
    expect(era2?.cards).toHaveLength(34);
    expect(era2?.cards.every((id) => id.startsWith("e2-"))).toBe(true);
    for (const id of era2?.cards ?? []) expect([...hands.lio, ...hands.sae]).not.toContain(id);
  });
  it("lets Era 3 enter on turn 5 with its 34 cards and the future cards on turn 6 with their 6, none dealt", () => {
    const { eras, hands } = firstDeckConfig("a").setup;
    expect(eras?.map((e) => [e.era, e.turn, e.cards.length])).toEqual([
      ["era-2", 3, 34],
      ["era-3", 5, 34],
      ["future", 6, 6],
    ]);
    expect(eras?.find((e) => e.era === "era-3")?.cards.every((id) => id.startsWith("e3-"))).toBe(true);
    expect(eras?.find((e) => e.era === "future")?.cards.every((id) => id.startsWith("ef-"))).toBe(true);
    const dealt = [...hands.lio, ...hands.sae];
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
