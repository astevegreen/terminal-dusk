import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";
import { ERA_3_CARDS } from "./era3Files.ts";
import { FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";
import { byText, eraDeckChecks, opsSpread, startEraOneGame } from "./test/eraChecks.ts";

describe("the Era 3 deck", () => {
  eraDeckChecks(ERA_3_CARDS, "era-3", [11, 12, 8]);
  it("follows the Ops spread of the plan less the removed cards, plus October 7 and Gaza and three LIO cards (Owner question 52): Ops 1/2/3/4 LIO 2/7/1/1, SAE 3/5/3/1, neutral 2/5/1/0", () => {
    expect(opsSpread(ERA_3_CARDS)).toEqual([
      [2, 7, 1, 1],
      [3, 5, 3, 1],
      [2, 5, 1, 0],
    ]);
  });
  it("shares no card id with Eras 1 and 2, and the first-deck ruleset holds every era", () => {
    const all = [...ERA_1_CARDS, ...ERA_2_CARDS, ...ERA_3_CARDS, ...FUTURE_CARDS];
    const ids = new Set(all.map((c) => c.id));
    expect(ids.size).toBe(96);
    expect(new Set(FIRST_DECK_RULESET.cards.map((c) => c.id))).toEqual(ids);
  });
});

describe("Era 3 in the first-deck TEST scenario", () => {
  const entry = FIRST_DECK_SCENARIO.eras?.find((e) => e.era === "era-3");
  it("enters on turn 3 with every Era 3 card, listed once", () => {
    expect(FIRST_DECK_SCENARIO.eras?.filter((e) => e.era === "era-3")).toHaveLength(1);
    expect(entry?.turn).toBe(3);
    expect([...(entry?.cards ?? [])].sort(byText)).toEqual(ERA_3_CARDS.map((c) => c.id).sort(byText));
  });
  it("is accepted by createGame, and its cards wait in the secret compartment, not in a hand or the draw pile", () => {
    const made = startEraOneGame();
    expect(made.ok).toBe(true);
    if (made.ok) {
      const waiting = made.value.state.secret.eras.flatMap((e) => e.cards);
      for (const card of ERA_3_CARDS) expect(waiting).toContain(card.id);
      // The draw pile holds only the Era 1 cards left after the turn 1 refill dealt both hands.
      expect(made.value.state.secret.deck.every((id) => id.startsWith("e1-"))).toBe(true);
    }
  });
});
