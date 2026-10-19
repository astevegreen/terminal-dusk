import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { FIRST_DECK_RULESET, cardName } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { eraDeckChecks, startEraOneGame } from "./test/eraChecks.ts";

describe("the Era 1 deck", () => {
  eraDeckChecks(ERA_1_CARDS, "era-1", [8, 13, 7]);
  it("shows the id for a card it does not know, so a missing name is visible", () => {
    expect(cardName("nope")).toBe("nope");
  });
  it("keeps real names out of card ids", () => {
    for (const card of ERA_1_CARDS) expect(card.id).toMatch(/^e1-(lio|sae|neu)-\d{3}$/);
  });
  it("leaves the engine's rules free of the text", () => {
    expect(FIRST_DECK_RULESET.cards).toHaveLength(91); // Eras 1 to 3 and the future cards; each era's test counts its own
    for (const def of FIRST_DECK_RULESET.cards) expect("text" in def).toBe(false);
  });
});

describe("the first-deck TEST scenario", () => {
  it("says in its name that it is a test with placeholder numbers", () => {
    expect(FIRST_DECK_SCENARIO.name).toMatch(/TEST/);
    expect(FIRST_DECK_SCENARIO.name).toMatch(/placeholder/);
  });
  it("refills hands to 8, the owner's hand size (deck-plan.md, Owner question 27)", () => {
    expect(FIRST_DECK_SCENARIO.handSize).toBe(8);
  });
  it("starts with an Era 1 draw pile that holds both sides' first hands", () => {
    expect(ERA_1_CARDS.length).toBeGreaterThanOrEqual(2 * FIRST_DECK_SCENARIO.handSize);
  });
  it("is accepted by createGame, and the turn 1 refill deals each side 8 Era 1 cards from the draw pile", () => {
    const made = startEraOneGame();
    expect(made.ok || made.error.code).toBe(true);
    if (!made.ok) return;
    const { state } = made.value;
    for (const side of ["lio", "sae"] as const) {
      expect(state.private[side].hand).toHaveLength(8);
      expect(state.private[side].hand.every((id) => id.startsWith("e1-"))).toBe(true);
    }
    expect(state.secret.deck).toHaveLength(ERA_1_CARDS.length - 16);
  });
});
