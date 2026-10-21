import { createGame, seedHash } from "@terminal-dusk/engine";
import type { CardDef, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import type { Scenario } from "../schema/scenario.ts";
import { DEFAULT_CONTINGENCY, scenarioSetup } from "./scenario.ts";

const base: Scenario = { id: "s1", name: "Test", turns: 3, playsPerTurn: 1, handSize: 2 };
const withEras: Scenario = {
  ...base,
  eras: [
    { era: "mid", turn: 2, cards: ["m1", "m2"] },
    { era: "late", turn: 3, cards: ["x1"] },
  ],
};

describe("scenarioSetup", () => {
  it("gives both sides 1 to 6 when the scenario names no contingency", () => {
    expect(DEFAULT_CONTINGENCY).toEqual([1, 2, 3, 4, 5, 6]);
    expect(scenarioSetup(base).contingency).toEqual({ lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] });
  });
  it("keeps a side's own list and defaults the other", () => {
    const got = scenarioSetup({ ...base, contingency: { lio: [2, 3, 3] } });
    expect(got.contingency).toEqual({ lio: [2, 3, 3], sae: [1, 2, 3, 4, 5, 6] });
  });
  it("copies turns, playsPerTurn and handSize", () => {
    expect(scenarioSetup(base)).toMatchObject({ turns: 3, playsPerTurn: 1, handSize: 2 });
  });
  it("returns an object with no eras key when the scenario has no eras", () => {
    expect("eras" in scenarioSetup(base)).toBe(false);
  });
  it("keeps eras: [] and the eras it is given", () => {
    expect(scenarioSetup({ ...base, eras: [] }).eras).toEqual([]);
    expect(scenarioSetup(withEras).eras).toEqual(withEras.eras);
  });
  it("holds fresh arrays: changing the result never changes the scenario or the default", () => {
    const scenario: Scenario = { ...withEras, contingency: { lio: [2, 3, 4], sae: [4, 5, 6] } };
    const before = JSON.parse(JSON.stringify(scenario)) as Scenario;
    const got = scenarioSetup(scenario);
    const lists = [got.contingency.lio, got.contingency.sae, got.eras!, ...got.eras!.map((e) => e.cards)];
    for (const list of lists) {
      (list as unknown[]).push("extra");
      (list as unknown[])[0] = "changed";
    }
    expect(scenario).toEqual(before);
    const defaults = scenarioSetup(base);
    defaults.contingency.lio.push(7);
    defaults.contingency.sae[0] = 9;
    expect(DEFAULT_CONTINGENCY).toEqual([1, 2, 3, 4, 5, 6]);
    expect(scenarioSetup(base).contingency.lio).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("combined with hands and a draw pile from a test ruleset, createGame accepts it", () => {
    const card = (id: string, era: string, affiliation: CardDef["affiliation"] = "neutral"): CardDef => ({
      id,
      era,
      ops: 1,
      affiliation,
      effect: [],
    });
    const ruleset = {
      id: "test-ruleset",
      cards: [
        ...["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => card(id, "early", "lio")),
        ...["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => card(id, "early", "sae")),
        card("d1", "early"),
        card("d2", "early"),
        card("m1", "mid"),
        card("m2", "mid"),
        card("x1", "late"),
      ],
    };
    const setup: Setup = {
      seedHash: seedHash("seed-1"),
      hands: { lio: ["l1", "l2", "l3", "l4", "l5", "l6"], sae: ["s1", "s2", "s3", "s4", "s5", "s6"] },
      deck: ["d1", "d2"],
      ...scenarioSetup(withEras),
    };
    expect(createGame(ruleset, setup, "seed-1").ok).toBe(true);
  });
});
