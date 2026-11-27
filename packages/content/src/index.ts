// Public entry point of the content package: the bundle of cards, map, scenarios and tutorial.
// So far scenario handling, the tutorial lesson schema and the bundled lessons; the schemas live in schema/.
export { DEFAULT_CONTINGENCY, scenarioSetup } from "./scenario.ts";
export type { ScenarioSetup } from "./scenario.ts";
export { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";
export { TEST_MAP_SCENARIO } from "./testMapScenario.ts";
export { lessonSchema } from "../schema/tutorial.ts";
export type { Lesson } from "../schema/tutorial.ts";
export { TUTORIAL_LESSONS } from "./tutorialLessons.ts";
