// The six Ops 4 cards are once-only events (deck-plan.md, wish W6; #204; Defence of Kyiv, Owner question 52):
// flagged removeAfterEvent, with the template sentence closing their rules text. No other card is once-only, and
// Era 1 still refills both hands.
import { describe, expect, it } from "vitest";
import { ERA_1_CARDS, cardDef } from "./era1.ts";
import { FIRST_DECK_CARDS, FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";

const ONCE_ONLY = ["e1-lio-006", "e1-sae-002", "e2-lio-007", "e2-sae-003", "e3-lio-014", "e3-sae-004"];
const TEMPLATE = "If this card's event happens, remove it from the game afterwards.";

describe("the once-only cards", () => {
  it("are the six Ops 4 cards, each flagged removeAfterEvent, and no other card gains the flag", () => {
    const flagged = FIRST_DECK_CARDS.filter((card) => card.flags !== undefined).map((card) => card.id);
    expect(flagged).toEqual(ONCE_ONLY);
    for (const card of FIRST_DECK_CARDS.filter((c) => ONCE_ONLY.includes(c.id))) {
      expect(card.ops).toBe(4);
      expect(card.flags).toEqual({ removeAfterEvent: true });
    }
  });

  it("end their rules text with the template sentence, word for word, after one space", () => {
    for (const card of FIRST_DECK_CARDS.filter((c) => ONCE_ONLY.includes(c.id))) {
      expect(card.text.rules.endsWith(` ${TEMPLATE}`)).toBe(true);
    }
  });

  it("only they say the template sentence", () => {
    const saying = FIRST_DECK_CARDS.filter((card) => card.text.rules.includes(TEMPLATE)).map((card) => card.id);
    expect(saying).toEqual(ONCE_ONLY);
  });

  it("keep their flag in the engine's rules, and a card with no flags gets no flags key", () => {
    const flagged = FIRST_DECK_RULESET.cards.filter((def) => def.flags?.removeAfterEvent === true).map((d) => d.id);
    expect(flagged).toEqual(ONCE_ONLY);
    const plain = ERA_1_CARDS.find((card) => card.flags === undefined)!;
    expect("flags" in cardDef(plain)).toBe(false);
  });
});

describe("the first-deck TEST scenario with once-only cards", () => {
  it("keeps 27 of Era 1's 29 cards in the game, at least twice the hand size of 8", () => {
    expect(ERA_1_CARDS).toHaveLength(29);
    const staying = ERA_1_CARDS.filter((card) => card.flags?.removeAfterEvent !== true);
    expect(staying).toHaveLength(27);
    expect(staying.length).toBeGreaterThanOrEqual(2 * FIRST_DECK_SCENARIO.handSize);
  });
});
