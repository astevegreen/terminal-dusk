// Public entry point of the content package: the bundle of cards, map, scenarios and tutorial.
// So far only scenario handling; the schemas live in schema/.
export { DEFAULT_CONTINGENCY, scenarioSetup } from "./scenario.ts";
export type { ScenarioSetup } from "./scenario.ts";
export { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";
export { TEST_MAP_SCENARIO } from "./testMapScenario.ts";
