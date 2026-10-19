// Test helpers shared by the era tests (era1.test.ts, era2.test.ts, era3.test.ts): the checks every era
// makes of its own cards, and the TEST-scenario game with the Era 1 deck in the draw pile that those tests start.
import { createGame, seedHash } from "@terminal-dusk/engine";
import { expect, it } from "vitest";
import { ERA_1_CARDS } from "../era1.ts";
import type { Card } from "../era1.ts";
import { FIRST_DECK_RULESET, cardName } from "../firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "../firstDeckScenario.ts";
import { scenarioSetup } from "../scenario.ts";

/** Sort orders for the tests' lists: card ids as text, Ops as numbers (a bare sort() would compare 10 before 9). */
export const byText = (a: string, b: string): number => a.localeCompare(b);
export const byNumber = (a: number, b: number): number => a - b;

/**
 * Cards the owner removed from the plan (not well known or significant enough). Their numbers stay unused, so the
 * ids of the other cards, the Notion rows and the docs keep matching.
 */
export const REMOVED_CARDS: readonly string[] = [
  "e1-lio-003",
  "e1-lio-005",
  "e1-lio-007",
  "e1-lio-008",
  "e1-lio-009",
  "e1-neu-005",
  "e2-lio-001",
  "e2-lio-003",
  "e2-lio-005",
  "e2-sae-006",
  "e2-sae-009",
  "e3-lio-004",
  "e3-lio-005",
  "e3-lio-007",
  "e3-lio-008",
  "e3-lio-012",
  "e3-sae-006",
  "e3-neu-006",
];

/**
 * The era's own tests: its LIO, SAE and neutral counts, its ids numbered lio 001-013, sae 001-013, neu 001-008
 * less the removed cards, and each card with a name and history.
 */
export function eraDeckChecks(
  cards: readonly Card[],
  era: "era-1" | "era-2" | "era-3",
  counts: readonly [lio: number, sae: number, neutral: number],
): void {
  const prefix = `e${era.slice(-1)}`;
  const count = (side: string) => cards.filter((c) => c.affiliation === side).length;
  it(`holds ${counts[0]} LIO cards, ${counts[1]} SAE cards and ${counts[2]} neutral cards`, () => {
    expect([count("lio"), count("sae"), count("neutral")]).toEqual(counts);
  });
  it("numbers its cards lio 001-013, sae 001-013, neu 001-008, leaving out only the removed cards", () => {
    const range = (side: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}-${side}-${String(i + 1).padStart(3, "0")}`);
    const expected = [...range("lio", 13), ...range("sae", 13), ...range("neu", 8)].filter(
      (id) => !REMOVED_CARDS.includes(id),
    );
    expect(cards.map((c) => c.id).sort(byText)).toEqual(expected.sort(byText));
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

/**
 * createGame's result for the first-deck TEST scenario as packages/host/src/firstDeck.ts starts it: empty hands and
 * every Era 1 card in the draw pile, so the turn 1 refill deals each side its first hand (core-loop.md).
 */
export function startEraOneGame(): ReturnType<typeof createGame> {
  return createGame(
    FIRST_DECK_RULESET,
    {
      seedHash: seedHash("s"),
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(FIRST_DECK_SCENARIO),
    },
    "s",
  );
}
