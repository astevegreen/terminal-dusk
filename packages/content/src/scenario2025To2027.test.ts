// The 2025-2027 game (docs/design/eras.md, "Optional scenario: 2025–2027"; owner, 21 Nov 2026): 11 turns, the
// future cards entering on turn 11, and the regions scoring at the ends of turns 3, 5 and 11 only: Era 3 once, at
// the end of 2027, not also at the end of 2025. Played on the six-region map, as the base game is, so the scoring
// turns come from the engine's regionScored events.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";
import { scenarioSetup } from "./scenario.ts";
import { SCENARIO_2025_2027 } from "./scenario2025To2027.ts";
import { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";
import { playScenario } from "./test/playScenario.ts";

const SIX_REGION_MAP = scenarioSetup(SIX_REGION_MAP_SCENARIO).map;
const FUTURE_IDS = FUTURE_CARDS.map((card) => card.id);

describe("the 2025-2027 scenario's file", () => {
  it("runs 11 turns with 2 plays each per turn and hands of 8, from Era 1", () => {
    expect(SCENARIO_2025_2027).toMatchObject({
      id: "2025-2027",
      turns: 11,
      playsPerTurn: 2,
      handSize: 8,
      firstEra: "era-1",
    });
    expect(SCENARIO_2025_2027.name).not.toMatch(/TEST|placeholder/i);
  });
  it("brings Era 2 in on turn 4, Era 3 on turn 6 and the future cards on turn 11, and only the future extends an era", () => {
    expect(SCENARIO_2025_2027.eras?.map((e) => [e.era, e.turn, e.extendsEra ?? false])).toEqual([
      ["era-2", 4, false],
      ["era-3", 6, false],
      ["future", 11, true],
    ]);
  });
  it("has the base game's Era 2 and Era 3 cards, and every future card in the future entry only", () => {
    const [era2, era3, future] = SCENARIO_2025_2027.eras!;
    expect([era2!.cards, era3!.cards]).toEqual(FIRST_DECK_SCENARIO.eras!.map((e) => e.cards));
    expect([...future!.cards].sort()).toEqual([...FUTURE_IDS].sort());
  });
  it("plays on a map with a future battleground list, which is Era 3's (map-and-points.md)", () => {
    const list = (era: string) => SIX_REGION_MAP?.battlegrounds.find((b) => b.era === era)?.countries;
    expect(list("future")).toEqual(list("era-3"));
  });
});

describe("the 2025-2027 game played through", () => {
  it.each(["late-a", "late-b", "late-c"])(
    "ends after turn 11, the future cards enter on turn 11 only, and the regions score at the ends of turns 3, 5 and 11 only (seed %s)",
    (seed) => {
      const { scoredTurns, eraTurns, futureFirstSeen, last } = playScenario(
        SCENARIO_2025_2027,
        seed,
        SIX_REGION_MAP,
        FUTURE_IDS,
      );
      expect(last.public.status).toMatchObject({ kind: "over" });
      expect(last.public.turn).toBe(11);
      expect(eraTurns).toEqual({ "era-2": 4, "era-3": 6, future: 11 });
      expect(futureFirstSeen).toBe(11);
      expect(scoredTurns).toEqual([3, 5, 11]);
    },
    60_000,
  );
});
