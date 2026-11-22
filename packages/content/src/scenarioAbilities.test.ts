// #602: each shipped scenario names both sides' special abilities and their numbers (docs/design/sides.md,
// "Asymmetry"), and scenarioSetup hands them to the engine. The numbers are data: perTurn 1 and bonus 1 today.
import { describe, expect, it } from "vitest";
import { scenarioSchema } from "../schema/scenario.ts";
import type { Scenario } from "../schema/scenario.ts";
import { ERA_1_FREE_SCENARIO } from "./eraOneFreeScenario.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { scenarioSetup } from "./scenario.ts";
import { SCENARIO_2025_2027 } from "./scenario2025To2027.ts";
import { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";

const SHIPPED: [string, Scenario][] = [
  ["base game", FIRST_DECK_SCENARIO],
  ["2025-2027", SCENARIO_2025_2027],
  ["Era 1 free", ERA_1_FREE_SCENARIO],
  ["six-region map", SIX_REGION_MAP_SCENARIO],
];

const BOTH = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "unifiedCommand", bonus: 1 },
} as const;

describe("the sides' abilities in the scenarios", () => {
  it.each(SHIPPED)("the %s scenario gives LIO Resilient institutions and SAE Unified command", (_name, scenario) => {
    expect(scenario.abilities).toEqual(BOTH);
    expect(scenarioSetup(scenario).abilities).toEqual(BOTH);
  });

  it("scenarioSetup copies the abilities, sharing no object with the scenario", () => {
    const got = scenarioSetup(SIX_REGION_MAP_SCENARIO).abilities!;
    expect(got.lio).not.toBe(SIX_REGION_MAP_SCENARIO.abilities!.lio);
    expect(got.sae).not.toBe(SIX_REGION_MAP_SCENARIO.abilities!.sae);
  });

  it("leaves abilities out of the setup when the scenario names none", () => {
    const { abilities: _none, ...rest } = SIX_REGION_MAP_SCENARIO;
    expect("abilities" in scenarioSetup(rest)).toBe(false);
  });

  const base = { id: "s", name: "S", turns: 3, playsPerTurn: 1, handSize: 2 };
  it.each([
    ["an unknown ability", { ...BOTH, sae: { id: "nope", bonus: 1 } }],
    ["a bonus of 0", { ...BOTH, sae: { id: "unifiedCommand", bonus: 0 } }],
    ["a fractional perTurn", { ...BOTH, lio: { id: "resilientInstitutions", perTurn: 1.5 } }],
    ["the wrong number for the ability", { ...BOTH, lio: { id: "resilientInstitutions", bonus: 1 } }],
    ["a missing side", { lio: BOTH.lio }],
    ["an extra field", { ...BOTH, world: BOTH.lio }],
  ])("the schema refuses %s", (_name, abilities) => {
    expect(scenarioSchema.safeParse({ ...base, abilities }).success).toBe(false);
  });
});
