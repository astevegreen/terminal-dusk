import { createGame, seedHash } from "@terminal-dusk/engine";
import type { CardDef } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { scenarioSchema } from "../schema/scenario.ts";
import type { Scenario } from "../schema/scenario.ts";
import firstDeckRaw from "../scenarios/first-deck-test.json" with { type: "json" };
import { TEST_MAP_SCENARIO as exported } from "./index.ts";
import { scenarioSetup } from "./scenario.ts";
import { TEST_MAP_SCENARIO } from "./testMapScenario.ts";

const map = TEST_MAP_SCENARIO.map!;

describe("the test map scenario", () => {
  it("is exported by packages/content", () => {
    expect(exported).toBe(TEST_MAP_SCENARIO);
  });
  it("is named as test data, not the game's map", () => {
    expect(TEST_MAP_SCENARIO.id).toBe("test-map");
    expect(TEST_MAP_SCENARIO.name).toMatch(/TEST/);
    expect(TEST_MAP_SCENARIO.name).toMatch(/not the game's map/);
  });
  it("has six regions and about 12 countries with made-up test names", () => {
    expect(map.regions).toHaveLength(6);
    expect(map.countries).toHaveLength(12);
    for (const c of [...map.regions, ...map.countries]) expect(c.name).toMatch(/^Test /);
  });
  it("has stabilities from 1 to 3 and, in every era, a battleground in each region", () => {
    expect(new Set(map.countries.map((c) => c.stability))).toEqual(new Set([1, 2, 3]));
    for (const r of map.regions) {
      for (const { countries } of map.battlegrounds) {
        expect(map.countries.some((c) => c.region === r.id && countries.includes(c.id))).toBe(true);
      }
    }
  });
  it("has a country next to each home box and one next to both", () => {
    expect(map.homeBox.lio.length).toBeGreaterThan(0);
    expect(map.homeBox.sae.length).toBeGreaterThan(0);
    expect(map.homeBox.lio.some((id) => map.homeBox.sae.includes(id))).toBe(true);
  });
  it("has a made-up closingOrder of 3 of its regions, none twice", () => {
    const ids = map.regions.map((r) => r.id);
    expect(map.closingOrder).toHaveLength(3);
    expect(new Set(map.closingOrder).size).toBe(3);
    for (const id of map.closingOrder) expect(ids).toContain(id);
  });
  it("gives each side some starting influence", () => {
    expect(map.startingInfluence.some((e) => e.lio > 0)).toBe(true);
    expect(map.startingInfluence.some((e) => e.sae > 0)).toBe(true);
  });
});

describe("scenarioSetup with a map", () => {
  it("passes the map through", () => {
    expect(scenarioSetup(TEST_MAP_SCENARIO).map).toEqual(map);
  });
  it("leaves map out when the scenario has none", () => {
    const noMap: Scenario = { ...TEST_MAP_SCENARIO };
    delete noMap.map;
    expect("map" in scenarioSetup(noMap)).toBe(false);
  });
  it("passes the map as fresh arrays and objects: changing the result does not change the scenario", () => {
    const scenario = JSON.parse(JSON.stringify(TEST_MAP_SCENARIO)) as Scenario;
    const before = JSON.parse(JSON.stringify(scenario)) as Scenario;
    const got = scenarioSetup(scenario).map!;
    got.regions[0]!.name = "changed";
    got.regions.push({ id: "x", name: "x" });
    got.closingOrder.reverse();
    got.countries[0]!.stability = 9;
    got.countries[0]!.neighbours.push("x");
    got.countries.pop();
    got.homeBox.lio.push("x");
    got.homeBox.sae[0] = "x";
    got.startingInfluence[0]!.lio = 9;
    got.startingInfluence.push({ country: "x", lio: 1, sae: 1 });
    expect(scenario).toEqual(before);
  });
  it("starts a game from test-map.json with the map and starting influence in the public state", () => {
    const card = (id: string, affiliation: CardDef["affiliation"]): CardDef => ({
      id,
      era: "early",
      ops: 1,
      affiliation,
      effect: [],
    });
    const lio = ["l1", "l2", "l3", "l4"];
    const sae = ["s1", "s2", "s3", "s4"];
    const ruleset = {
      id: "test-ruleset",
      cards: [...lio.map((id) => card(id, "lio")), ...sae.map((id) => card(id, "sae")), card("d1", "neutral")],
    };
    const result = createGame(
      ruleset,
      { seedHash: seedHash("seed-1"), hands: { lio, sae }, deck: ["d1"], ...scenarioSetup(TEST_MAP_SCENARIO) },
      "seed-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pub = result.value.state.public;
    expect(pub.map?.regions).toEqual(map.regions);
    expect(pub.map?.closingOrder).toEqual(map.closingOrder);
    expect(pub.map?.countries).toEqual(map.countries);
    expect(pub.map?.homeBox).toEqual(map.homeBox);
    expect(pub.influence).toHaveLength(12);
    expect(pub.influence?.find((e) => e.country === "test-a1")).toEqual({ country: "test-a1", lio: 2, sae: 0 });
    expect(pub.influence?.find((e) => e.country === "test-c1")).toEqual({ country: "test-c1", lio: 1, sae: 1 });
    expect(pub.influence?.find((e) => e.country === "test-e1")).toEqual({ country: "test-e1", lio: 0, sae: 2 });
    expect(pub.influence?.find((e) => e.country === "test-d1")).toEqual({ country: "test-d1", lio: 0, sae: 0 });
  });
  it("keeps first-deck-test.json valid, with no map", () => {
    expect("map" in firstDeckRaw).toBe(false);
    expect(scenarioSchema.safeParse(firstDeckRaw).success).toBe(true);
    expect("map" in scenarioSetup(scenarioSchema.parse(firstDeckRaw))).toBe(false);
  });
});
