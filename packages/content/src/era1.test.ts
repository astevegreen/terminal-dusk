import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { FIRST_DECK_RULESET, cardName } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { eraDeckChecks, startEraOneGame } from "./test/eraChecks.ts";

const count = (side: string) => ERA_1_CARDS.filter((c) => c.affiliation === side).length;

describe("the Era 1 deck", () => {
  eraDeckChecks(ERA_1_CARDS, "era-1");
  it("shows the id for a card it does not know, so a missing name is visible", () => {
    expect(cardName("nope")).toBe("nope");
  });
  it("keeps real names out of card ids", () => {
    for (const card of ERA_1_CARDS) expect(card.id).toMatch(/^e1-(lio|sae|neu)-\d{3}$/);
  });
  it("leaves the engine's rules free of the text", () => {
    expect(FIRST_DECK_RULESET.cards).toHaveLength(108); // Eras 1 to 3 and the future cards; each era's test counts its own
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
    const made = startEraOneGame();
    expect(made.ok || made.error.code).toBe(true);
  });
});
