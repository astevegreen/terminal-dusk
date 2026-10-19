import { SIDES, apply, legalAnswers } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { FIRST_DECK_NOTE, firstDeckCardName, firstDeckConfig, firstDeckRuleset } from "./firstDeck.ts";
import { hostCreate } from "./index.ts";

const byText = (a: string, b: string): number => a.localeCompare(b);

/** The game state right after hostCreate starts the first deck with `seed`: the turn 1 refill has run. */
function started(seed: string) {
  const r = hostCreate(firstDeckRuleset, firstDeckConfig(), seed, 0);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value.secret.state;
}

describe("the first deck as a game", () => {
  it("starts with empty hands and all 28 Era 1 cards, each once, in the draw pile", () => {
    const { hands, deck } = firstDeckConfig().setup;
    expect(hands).toEqual({ lio: [], sae: [] });
    expect(new Set(deck).size).toBe(28);
    // Only Era 1 starts in the draw pile; later eras wait in the scenario's eras and join it on their turns.
    expect([...deck].sort(byText)).toEqual(
      firstDeckRuleset.cards
        .map((c) => c.id)
        .filter((id) => id.startsWith("e1-"))
        .sort(byText),
    );
  });
  it("uses the scenario's hand size of 8", () => {
    expect(firstDeckConfig().setup.handSize).toBe(8);
  });
  it("deals each side 8 Era 1 cards on turn 1, leaving the other 12 in the draw pile", () => {
    const state = started("a");
    for (const side of SIDES) {
      expect(state.private[side].hand).toHaveLength(8);
      expect(state.private[side].hand.every((id) => id.startsWith("e1-"))).toBe(true);
    }
    expect(state.secret.deck).toHaveLength(12);
  });
  it("deals the same hands for the same seed and different hands for another", () => {
    const hands = (seed: string) => SIDES.map((side) => started(seed).private[side].hand);
    expect(hands("a")).toEqual(hands("a"));
    expect(hands("a")).not.toEqual(hands("b"));
  });
  it("refills both hands to 8 on turn 2, from a draw pile that now holds the Era 2 cards", () => {
    let state = started("a");
    // Each open decision gets its first legal answer until turn 2's opening pick opens.
    while (state.public.turn < 2 || state.private.lio.picks.length + state.private.sae.picks.length > 0) {
      const d = state.public.pending[0]!;
      const r = apply(firstDeckRuleset, state, {
        decisionId: d.id,
        side: d.side,
        value: legalAnswers(firstDeckRuleset, state, d.side)[0]!,
      });
      if (!r.ok) throw new Error(`answer refused: ${r.error.code}`);
      state = r.value.state;
    }
    for (const side of SIDES) expect(state.private[side].hand).toHaveLength(8);
    expect(state.secret.deck.some((id) => id.startsWith("e2-"))).toBe(true);
  });
  it("lets Era 2 enter on turn 2 with all 29 of its cards, none of them in the starting draw pile", () => {
    const { eras, deck } = firstDeckConfig().setup;
    const era2 = eras?.find((e) => e.era === "era-2");
    expect(era2).toMatchObject({ era: "era-2", turn: 2 });
    expect(era2?.cards).toHaveLength(29);
    expect(era2?.cards.every((id) => id.startsWith("e2-"))).toBe(true);
    for (const id of era2?.cards ?? []) expect(deck).not.toContain(id);
  });
  it("lets Era 3 enter on turn 3 with its 28 cards and the future cards on turn 4 with their 6, none in the first pile", () => {
    const { eras, deck } = firstDeckConfig().setup;
    expect(eras?.map((e) => [e.era, e.turn, e.cards.length])).toEqual([
      ["era-2", 2, 29],
      ["era-3", 3, 28],
      ["future", 4, 6],
    ]);
    expect(eras?.find((e) => e.era === "era-3")?.cards.every((id) => id.startsWith("e3-"))).toBe(true);
    expect(eras?.find((e) => e.era === "future")?.cards.every((id) => id.startsWith("ef-"))).toBe(true);
    for (const id of (eras ?? []).flatMap((e) => e.cards)) expect(deck).not.toContain(id);
  });
  it("starts a match with the engine for many seeds", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(hostCreate(firstDeckRuleset, firstDeckConfig(), seed, 0).ok).toBe(true);
    }
  });
  it("names its cards with real card names and labels the game as a TEST", () => {
    expect(firstDeckCardName("e1-lio-001")).not.toBe("e1-lio-001");
    expect(FIRST_DECK_NOTE).toMatch(/TEST/);
  });
});
