// The six-region map (#422; docs/design/map-and-points.md, "Map"): option 2 of docs/proposals/map-content/, home-box
// option H1, Crimea its own box, closing order C1, regions listed in the scoring order S1 (owner, 28 Oct).
// Data plus tests for now: the app, the host, the fuzz suites and the card tests still play the test map.
// Placeholders until the balance pass (owner's open questions, map-and-points.md):
// - every stability is option 2's placeholder; Crimea's is Ukraine's 2 (owner, 28 Oct: "2, like Ukraine");
// - battlegrounds are option 2's flags, the same for every era: each era's own list waits on the owner, and the one
//   flag per country becomes a list per era in a follow-up engine issue (architect, #422);
// - starting influence: Taiwan LIO 3, Crimea SAE 1, every other country empty (owner, 28 Oct: "Placeholders");
// - turns, plays per turn and hand size are first-deck-test.json's.
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/six-region-map.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const SIX_REGION_MAP_SCENARIO = scenarioSchema.parse(raw);
