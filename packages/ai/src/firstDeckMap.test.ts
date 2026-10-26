// Easy with the real first-deck cards on the test map, so the sixteen R18 cards that move Escalation are in play
// (A11a, issue #359).
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { seededRandom } from "./random.ts";
import { newFirstDeckMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 10;

/** The sixteen cards that move Escalation by 1, as listed in packages/content/src/escalationCards.test.ts. */
const ESCALATION_CARDS = [
  "e1-lio-006",
  "e1-sae-004",
  "e1-sae-007",
  "e2-lio-004",
  "e2-sae-001",
  "e2-sae-007",
  "e2-sae-013",
  "e3-sae-003",
  "e3-sae-004",
  "e3-sae-012",
  "e1-lio-002",
  "e1-lio-012",
  "e1-lio-013",
  "e1-neu-004",
  "e2-lio-006",
  "e2-lio-013",
];

type Played = { finals: TestState[]; cards: Set<string> };

let cached: Played | null = null;
/** The 10 seeded games, played once: every game's last state and every card an answer named. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], cards: new Set() };
  for (let seed = 1; seed <= GAMES; seed++) {
    const final = playEasy(FIRST_DECK_RULESET, newFirstDeckMapGame(seed), EASY_WEIGHTS, seededRandom(seed), {
      name: `first-deck map game ${seed}`,
      applied: (_before, _after, _events, answer) => {
        const value = "value" in answer ? answer.value : null;
        if (value?.kind === "playCardAs" || value?.kind === "chooseCard") into.cards.add(value.card);
      },
    });
    into.finals.push(final);
  }
  cached = into;
  return into;
}

describe("Easy with the real first deck on the test map", () => {
  it("the first-deck map games start with the map, influence and Escalation 2", () => {
    const start = newFirstDeckMapGame(1);
    expect(start.public.status.kind).toBe("active");
    expect(start.public.map).toBeDefined();
    expect(start.public.influence).toBeDefined();
    expect(start.public.escalation).toBe(2);
  });

  it("plays 10 seeded first-deck map games on both sides with only legal answers, and every game ends", () => {
    const { finals } = played();
    expect(finals).toHaveLength(GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
  });

  it("at least one of the sixteen cards that move Escalation is played across those games", () => {
    const { cards } = played();
    expect(ESCALATION_CARDS.some((id) => cards.has(id))).toBe(true);
  });
});
