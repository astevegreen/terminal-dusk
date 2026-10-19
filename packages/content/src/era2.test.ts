import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";
import { FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { eraDeckChecks, opsSpread, startEraOneGame } from "./test/eraChecks.ts";

describe("the Era 2 deck", () => {
  eraDeckChecks(ERA_2_CARDS, "era-2");
  it("follows the Ops spread of the plan: LIO and SAE 3/6/3/1 cards of Ops 1/2/3/4, neutral 3/4/1/0", () => {
    expect(opsSpread(ERA_2_CARDS)).toEqual([
      [3, 6, 3, 1],
      [3, 6, 3, 1],
      [3, 4, 1, 0],
    ]);
  });
  it("shares no card id with Era 1, and the first-deck ruleset holds both eras", () => {
    const ids = new Set([...ERA_1_CARDS, ...ERA_2_CARDS].map((c) => c.id));
    expect(ids.size).toBe(68);
    const inRuleset = new Set(FIRST_DECK_RULESET.cards.map((c) => c.id));
    for (const id of ids) expect(inRuleset.has(id)).toBe(true);
  });
});

describe("Era 2 in the first-deck TEST scenario", () => {
  const entry = FIRST_DECK_SCENARIO.eras?.find((e) => e.era === "era-2");
  it("enters on turn 3 with every Era 2 card, listed once", () => {
    expect(FIRST_DECK_SCENARIO.eras?.filter((e) => e.era === "era-2")).toHaveLength(1);
    expect(entry?.era).toBe("era-2");
    expect(entry?.turn).toBe(3);
    expect([...(entry?.cards ?? [])].sort()).toEqual(ERA_2_CARDS.map((c) => c.id).sort());
  });
  it("is accepted by createGame, and its cards wait in the secret compartment, not in a hand or the draw pile", () => {
    const made = startEraOneGame();
    expect(made.ok).toBe(true);
    if (made.ok) {
      expect(made.value.state.secret.eras).toHaveLength(3); // Era 2, Era 3 and the future cards (era3.test.ts, future.test.ts)
      expect(made.value.state.secret.deck).toEqual([]);
    }
  });
});
