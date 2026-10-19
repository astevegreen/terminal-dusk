// Test helpers shared by the era tests (era1.test.ts, era2.test.ts, era3.test.ts): the checks every 34-card era
// makes of its own cards, and the TEST-scenario game with the whole Era 1 deck dealt that those tests start.
import { createGame, seedHash } from "@terminal-dusk/engine";
import { expect, it } from "vitest";
import { ERA_1_CARDS } from "../era1.ts";
import type { Card } from "../era1.ts";
import { FIRST_DECK_RULESET, cardName } from "../firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "../firstDeckScenario.ts";
import { scenarioSetup } from "../scenario.ts";

/** The era's own tests: 13 LIO, 13 SAE and 8 neutral cards, numbered without gaps, each with a name and history. */
export function eraDeckChecks(cards: readonly Card[], era: "era-1" | "era-2" | "era-3"): void {
  const prefix = `e${era.slice(-1)}`;
  const count = (side: string) => cards.filter((c) => c.affiliation === side).length;
  it("holds 13 LIO cards, 13 SAE cards and 8 neutral cards", () => {
    expect([count("lio"), count("sae"), count("neutral")]).toEqual([13, 13, 8]);
  });
  it("numbers its cards without gaps: lio 001-013, sae 001-013, neu 001-008", () => {
    const range = (side: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}-${side}-${String(i + 1).padStart(3, "0")}`);
    const expected = [...range("lio", 13), ...range("sae", 13), ...range("neu", 8)];
    expect(cards.map((c) => c.id).sort()).toEqual(expected.sort());
  });
  it(`gives every card its own id, the era string ${era}, a name and a history note`, () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    for (const card of cards) {
      expect(card.era).toBe(era);
      expect(card.id).toMatch(new RegExp(`^${prefix}-(lio|sae|neu)-\\d{3}$`));
      expect(card.text.name.length).toBeGreaterThan(0);
      expect(card.text.history.length).toBeGreaterThan(0);
      expect(cardName(card.id)).toBe(card.text.name);
    }
  });
}

/** The Ops spread of the plan, per side: how many cards of Ops 1, 2, 3 and 4 the era's LIO, SAE and neutral cards have. */
export function opsSpread(cards: readonly Card[]): number[][] {
  const spread = (side: string) =>
    [1, 2, 3, 4].map((ops) => cards.filter((c) => c.affiliation === side && c.ops === ops).length);
  return [spread("lio"), spread("sae"), spread("neutral")];
}

/** The whole Era 1 deck dealt: each side 9 of its own cards, the other 4 of the rival's, and 4 neutral cards. */
export function eraOneHands(): { lio: string[]; sae: string[] } {
  const e1 = ERA_1_CARDS.map((c) => c.id);
  const of = (k: string) => e1.filter((id) => id.includes(k));
  return {
    lio: [...of("-lio-").slice(0, 9), ...of("-sae-").slice(9), ...of("-neu-").slice(0, 4)],
    sae: [...of("-sae-").slice(0, 9), ...of("-lio-").slice(9), ...of("-neu-").slice(4)],
  };
}

/** createGame's result for the first-deck TEST scenario with the Era 1 deck dealt as eraOneHands says. */
export function startEraOneGame(): ReturnType<typeof createGame> {
  return createGame(
    FIRST_DECK_RULESET,
    { seedHash: seedHash("s"), hands: eraOneHands(), deck: [], ...scenarioSetup(FIRST_DECK_SCENARIO) },
    "s",
  );
}
