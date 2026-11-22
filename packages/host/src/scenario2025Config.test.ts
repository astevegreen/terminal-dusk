// The optional 2025-2027 game as the host hands it to the app (#601): 11 turns, the future cards on turn 11, on the
// six-region map, whose future battleground list must be Era 3's because Era 3 scores once, at the end of turn 11.
import { ERA_1_CARDS, FUTURE_CARDS, SCENARIO_2025_2027 } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import {
  SCENARIO_2025_2027_NOTE,
  firstDeckConfig,
  firstDeckRuleset,
  futureBattlegroundsMatchEra3,
  scenario2025To2027Config,
} from "./firstDeck.ts";
import { hostCreate } from "./index.ts";

describe("scenario2025To2027Config", () => {
  it("is 11 turns of 2 plays with hands of 8, as the scenario file says", () => {
    const { setup } = scenario2025To2027Config();
    expect(setup.turns).toBe(11);
    expect(setup.turns).toBe(SCENARIO_2025_2027.turns);
    expect(setup.playsPerTurn).toBe(SCENARIO_2025_2027.playsPerTurn);
    expect(setup.handSize).toBe(SCENARIO_2025_2027.handSize);
  });
  it("starts with Era 1's cards, and brings Era 2 on turn 4, Era 3 on turn 6 and every future card on turn 11", () => {
    const { setup } = scenario2025To2027Config();
    expect(setup.deck).toEqual(ERA_1_CARDS.map((c) => c.id));
    expect(setup.hands).toEqual({ lio: [], sae: [] });
    expect(setup.eras?.map((e) => [e.era, e.turn, e.extendsEra ?? false])).toEqual([
      ["era-2", 4, false],
      ["era-3", 6, false],
      ["future", 11, true],
    ]);
    expect([...setup.eras![2]!.cards].sort()).toEqual(FUTURE_CARDS.map((c) => c.id).sort());
  });
  it("plays on the six-region map, whose future battlegrounds are Era 3's", () => {
    const { map } = scenario2025To2027Config().setup;
    expect(map?.regions).toHaveLength(6);
    expect(futureBattlegroundsMatchEra3(map!)).toBe(true);
  });
  it("starts through hostCreate with the ruleset that knows the future cards", () => {
    const r = hostCreate(firstDeckRuleset, scenario2025To2027Config(), "future-seed", 0);
    expect(r.ok).toBe(true);
  });
  it("has its own match id, the same players as the base game, and a note naming 2027 and 11 turns", () => {
    expect(scenario2025To2027Config().matchId).toBe("2025-2027");
    expect(scenario2025To2027Config().players).toEqual(firstDeckConfig().players);
    expect(SCENARIO_2025_2027_NOTE).toMatch(/2027/);
    expect(SCENARIO_2025_2027_NOTE).toMatch(/11 turns/);
  });
  it("gives a fresh config each call", () => {
    expect(scenario2025To2027Config().setup.deck).not.toBe(scenario2025To2027Config().setup.deck);
    expect(scenario2025To2027Config().setup.map).not.toBe(scenario2025To2027Config().setup.map);
  });
});

describe("futureBattlegroundsMatchEra3", () => {
  const { map } = scenario2025To2027Config().setup;
  it("is false when the future list differs from Era 3's", () => {
    const changed = {
      ...map!,
      battlegrounds: map!.battlegrounds.map((b) =>
        b.era === "future" ? { ...b, countries: b.countries.slice(1) } : b,
      ),
    };
    expect(futureBattlegroundsMatchEra3(changed)).toBe(false);
  });
  it("is false when the map has no future list or no Era 3 list", () => {
    const without = (era: string) => ({ ...map!, battlegrounds: map!.battlegrounds.filter((b) => b.era !== era) });
    expect(futureBattlegroundsMatchEra3(without("future"))).toBe(false);
    expect(futureBattlegroundsMatchEra3(without("era-3"))).toBe(false);
  });
  it("ignores the order of the countries", () => {
    const reversed = {
      ...map!,
      battlegrounds: map!.battlegrounds.map((b) =>
        b.era === "future" ? { ...b, countries: b.countries.toReversed() } : b,
      ),
    };
    expect(futureBattlegroundsMatchEra3(reversed)).toBe(true);
  });
});
