import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";
import { ERA_3_CARDS } from "./era3Files.ts";
import { FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";
import { byText, eraDeckChecks, opsSpread, startEraOneGame } from "./test/eraChecks.ts";

describe("the Era 3 deck", () => {
  eraDeckChecks(ERA_3_CARDS, "era-3");
  it("follows the Ops spread of the plan: LIO and SAE 3/6/3/1 cards of Ops 1/2/3/4, neutral 3/4/1/0", () => {
    expect(opsSpread(ERA_3_CARDS)).toEqual([
      [3, 6, 3, 1],
      [3, 6, 3, 1],
      [3, 4, 1, 0],
    ]);
  });
  it("shares no card id with Eras 1 and 2, and the first-deck ruleset holds every era", () => {
    const all = [...ERA_1_CARDS, ...ERA_2_CARDS, ...ERA_3_CARDS, ...FUTURE_CARDS];
    const ids = new Set(all.map((c) => c.id));
    expect(ids.size).toBe(108);
    expect(new Set(FIRST_DECK_RULESET.cards.map((c) => c.id))).toEqual(ids);
  });
});

describe("Era 3 in the first-deck TEST scenario", () => {
  const entry = FIRST_DECK_SCENARIO.eras?.find((e) => e.era === "era-3");
  it("enters on turn 5 with every Era 3 card, listed once", () => {
    expect(FIRST_DECK_SCENARIO.eras?.filter((e) => e.era === "era-3")).toHaveLength(1);
    expect(entry?.turn).toBe(5);
    expect([...(entry?.cards ?? [])].sort(byText)).toEqual(ERA_3_CARDS.map((c) => c.id).sort(byText));
  });
  it("is accepted by createGame, and its cards wait in the secret compartment, not in a hand or the draw pile", () => {
    const made = startEraOneGame();
    expect(made.ok).toBe(true);
    if (made.ok) {
      const waiting = made.value.state.secret.eras.flatMap((e) => e.cards);
      for (const card of ERA_3_CARDS) expect(waiting).toContain(card.id);
      expect(made.value.state.secret.deck).toEqual([]);
    }
  });
});
