import { createGame, seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";
import { FIRST_DECK_RULESET, cardName } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { scenarioSetup } from "./scenario.ts";

const count = (side: string) => ERA_2_CARDS.filter((c) => c.affiliation === side).length;

describe("the Era 2 deck", () => {
  it("holds 13 LIO cards, 13 SAE cards and 8 neutral cards", () => {
    expect([count("lio"), count("sae"), count("neutral")]).toEqual([13, 13, 8]);
  });
  it("numbers its cards without gaps: lio 001-013, sae 001-013, neu 001-008", () => {
    const range = (side: string, n: number) =>
      Array.from({ length: n }, (_, i) => `e2-${side}-${String(i + 1).padStart(3, "0")}`);
    const expected = [...range("lio", 13), ...range("sae", 13), ...range("neu", 8)];
    expect(ERA_2_CARDS.map((c) => c.id).sort()).toEqual(expected.sort());
  });
  it("gives every card its own id, the era string era-2, a name and a history note", () => {
    expect(new Set(ERA_2_CARDS.map((c) => c.id)).size).toBe(ERA_2_CARDS.length);
    for (const card of ERA_2_CARDS) {
      expect(card.era).toBe("era-2");
      expect(card.id).toMatch(/^e2-(lio|sae|neu)-\d{3}$/);
      expect(card.text.name.length).toBeGreaterThan(0);
      expect(card.text.history.length).toBeGreaterThan(0);
      expect(cardName(card.id)).toBe(card.text.name);
    }
  });
  it("follows the Ops spread of the plan: LIO and SAE 3/6/3/1 cards of Ops 1/2/3/4, neutral 3/4/1/0", () => {
    const spread = (side: string) =>
      [1, 2, 3, 4].map((ops) => ERA_2_CARDS.filter((c) => c.affiliation === side && c.ops === ops).length);
    expect([spread("lio"), spread("sae"), spread("neutral")]).toEqual([
      [3, 6, 3, 1],
      [3, 6, 3, 1],
      [3, 4, 1, 0],
    ]);
  });
  it("shares no card id with Era 1, and the first-deck ruleset holds both eras", () => {
    const ids = new Set([...ERA_1_CARDS, ...ERA_2_CARDS].map((c) => c.id));
    expect(ids.size).toBe(68);
    expect(new Set(FIRST_DECK_RULESET.cards.map((c) => c.id))).toEqual(ids);
  });
});

describe("Era 2 in the first-deck TEST scenario", () => {
  const entry = FIRST_DECK_SCENARIO.eras?.[0];
  it("enters on turn 3 with every Era 2 card, listed once", () => {
    expect(FIRST_DECK_SCENARIO.eras).toHaveLength(1);
    expect(entry?.era).toBe("era-2");
    expect(entry?.turn).toBe(3);
    expect([...(entry?.cards ?? [])].sort()).toEqual(ERA_2_CARDS.map((c) => c.id).sort());
  });
  it("is accepted by createGame, and its cards wait in the secret compartment, not in a hand or the draw pile", () => {
    const e1 = ERA_1_CARDS.map((c) => c.id);
    const of = (k: string) => e1.filter((id) => id.includes(k));
    const hands = {
      lio: [...of("-lio-").slice(0, 9), ...of("-sae-").slice(9), ...of("-neu-").slice(0, 4)],
      sae: [...of("-sae-").slice(0, 9), ...of("-lio-").slice(9), ...of("-neu-").slice(4)],
    };
    const made = createGame(
      FIRST_DECK_RULESET,
      { seedHash: seedHash("s"), hands, deck: [], ...scenarioSetup(FIRST_DECK_SCENARIO) },
      "s",
    );
    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.value.state.secret.eras).toHaveLength(1);
      expect(made.value.state.secret.deck).toEqual([]);
    }
  });
});
