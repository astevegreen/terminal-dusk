// The TEST scenario with a made-up map, for tests and fuzz suites. Its regions, countries, adjacency, stabilities,
// battlegrounds and starting influence are test data, not the game's map (map-and-points.md leaves those open);
// its turns, plays per turn and hand size are placeholders.
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/test-map.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const TEST_MAP_SCENARIO = scenarioSchema.parse(raw);
