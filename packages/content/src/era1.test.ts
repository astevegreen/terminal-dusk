import { createGame, seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { ERA_1_CARDS, FIRST_DECK_RULESET, cardName } from "./era1.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { scenarioSetup } from "./scenario.ts";

const count = (side: string) => ERA_1_CARDS.filter((c) => c.affiliation === side).length;

describe("the Era 1 deck", () => {
  it("holds 13 LIO cards, 13 SAE cards and 8 neutral cards", () => {
    expect([count("lio"), count("sae"), count("neutral")]).toEqual([13, 13, 8]);
  });
  it("numbers its cards without gaps: lio 001-013, sae 001-013, neu 001-008", () => {
    const range = (side: string, n: number) =>
      Array.from({ length: n }, (_, i) => `e1-${side}-${String(i + 1).padStart(3, "0")}`);
    const expected = [...range("lio", 13), ...range("sae", 13), ...range("neu", 8)];
    expect(ERA_1_CARDS.map((c) => c.id).sort()).toEqual(expected.sort());
  });
  it("gives every card its own id, the era string era-1, a name and a history note", () => {
    expect(new Set(ERA_1_CARDS.map((c) => c.id)).size).toBe(ERA_1_CARDS.length);
    for (const card of ERA_1_CARDS) {
      expect(card.era).toBe("era-1");
      expect(card.text.name.length).toBeGreaterThan(0);
      expect(card.text.history.length).toBeGreaterThan(0);
      expect(cardName(card.id)).toBe(card.text.name);
    }
  });
  it("shows the id for a card it does not know, so a missing name is visible", () => {
    expect(cardName("nope")).toBe("nope");
  });
  it("keeps real names out of card ids", () => {
    for (const card of ERA_1_CARDS) expect(card.id).toMatch(/^e1-(lio|sae|neu)-\d{3}$/);
  });
  it("leaves the engine's rules free of the text", () => {
    expect(FIRST_DECK_RULESET.cards).toHaveLength(34);
    for (const def of FIRST_DECK_RULESET.cards) expect("text" in def).toBe(false);
  });
});

describe("the first-deck TEST scenario", () => {
  it("says in its name that it is a test with placeholder numbers", () => {
    expect(FIRST_DECK_SCENARIO.name).toMatch(/TEST/);
    expect(FIRST_DECK_SCENARIO.name).toMatch(/placeholder/);
  });
  it("needs no more non-neutral cards per side than the deck can give", () => {
    const needed = FIRST_DECK_SCENARIO.turns * (1 + FIRST_DECK_SCENARIO.playsPerTurn);
    expect(needed).toBeLessThanOrEqual(count("lio") + count("sae") - 13); // a side holds its 9 own + 4 rival cards
  });
  it("is accepted by createGame with the whole deck dealt", () => {
    const ids = ERA_1_CARDS.map((c) => c.id);
    const lio = ids.filter((id) => id.includes("-lio-")).slice(0, 9);
    const sae = ids.filter((id) => id.includes("-sae-")).slice(0, 9);
    const neutral = ids.filter((id) => id.includes("-neu-"));
    const hands = {
      lio: [...lio, ...ids.filter((id) => id.includes("-sae-")).slice(9), ...neutral.slice(0, 4)],
      sae: [...sae, ...ids.filter((id) => id.includes("-lio-")).slice(9), ...neutral.slice(4)],
    };
    const made = createGame(
      FIRST_DECK_RULESET,
      { seedHash: seedHash("s"), hands, deck: [], ...scenarioSetup(FIRST_DECK_SCENARIO) },
      "s",
    );
    expect(made.ok || made.error.code).toBe(true);
  });
});
