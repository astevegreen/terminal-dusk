// Test helpers for map games (A11a, issue #359; A11b, #360): small rulesets whose cards move Escalation or spend
// event points, dealt with the test map, and first-deck games with the real cards on the test map.
import { FIRST_DECK_RULESET, FIRST_DECK_SCENARIO, ERA_1_CARDS, scenarioSetup } from "@terminal-dusk/content/first-deck";
import { TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import { createGame, seedHash } from "@terminal-dusk/engine";
import type { Ruleset, Setup, Step } from "@terminal-dusk/engine";
import { dealGame, ninetyCards } from "./testGames.ts";
import type { TestState } from "./testGames.ts";

/** A fresh copy of the test map, starting influence included. */
export const testMap = (): NonNullable<Setup["map"]> => scenarioSetup(TEST_MAP_SCENARIO).map!;

/**
 * Card i's effect, by i % 6: 0 raises Escalation by 1, 1 raises it by 2, 2 lowers it by 1, 3 asks LIO a yes/no and
 * then raises it by 1 (so a state can pause mid-card), and 4 and 5 do nothing.
 */
function effectOf(i: number): Step[] {
  switch (i % 6) {
    case 0:
      return [{ op: "escalate", by: 1 }];
    case 1:
      return [{ op: "escalate", by: 2 }];
    case 2:
      return [{ op: "escalate", by: -1 }];
    case 3:
      return [
        { op: "choose", who: "lio", decision: { kind: "yesNo" }, bind: "a" },
        { op: "escalate", by: 1 },
      ];
    default:
      return [];
  }
}

/** Ninety cards: ops 0-4, affiliations in turn, and the Escalation moves of effectOf. */
export const escalationRuleset = ninetyCards("ai-escalation-test", "x", effectOf);

/** A game of escalationRuleset from `seed` on the test map, dealt by dealGame. Four turns by default. */
export function newMapGame(seed: number, turns = 4): TestState {
  return dealGame(escalationRuleset, "ai-map", seed, turns, { map: testMap() });
}

/**
 * Ninety cards that all print 0 ops, every other one with a "both get 1" event line (A11b, issue #360): LIO spends
 * 1 point, then SAE does. With no ops to play for, every placement in these games comes from an event line.
 */
export const pointsRuleset: Ruleset = (() => {
  const rules = ninetyCards("ai-points-test", "p", (i) =>
    i % 2 === 0
      ? [
          { op: "spendPoints", side: "lio", amount: 1 },
          { op: "spendPoints", side: "sae", amount: 1 },
        ]
      : [],
  );
  return { ...rules, cards: rules.cards.map((card) => ({ ...card, ops: 0 })) };
})();

/** A game of pointsRuleset from `seed` on the test map, dealt by dealGame. Four turns by default. */
export function newPointsMapGame(seed: number, turns = 4): TestState {
  return dealGame(pointsRuleset, "ai-points", seed, turns, { map: testMap() });
}

/** A first-deck game from `seed` set up as the host sets one up (firstDeckConfig), plus the test map. */
export function newFirstDeckMapGame(seed: number): TestState {
  const name = `ai-first-deck-${seed}`;
  const setup: Setup = {
    seedHash: seedHash(name),
    hands: { lio: [], sae: [] },
    deck: ERA_1_CARDS.map((card) => card.id),
    ...scenarioSetup(FIRST_DECK_SCENARIO),
    map: testMap(),
  };
  const made = createGame(FIRST_DECK_RULESET, setup, name);
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  return made.value.state;
}
