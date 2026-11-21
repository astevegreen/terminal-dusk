// The six-region map (#422; docs/design/map-and-points.md, "Map"): option 2 of docs/proposals/map-content/, home-box
// option H1, Crimea its own box, closing order C1, regions listed in the scoring order S1 (owner, 28 Oct).
// Data plus tests for now: the app, the host, the fuzz suites and the card tests still play the test map.
// Its numbers are option A of docs/proposals/map-numbers/ as the owner chose it on 28 Oct (R24, #458):
// - stabilities: option A's ("A, tune later"), until a balance pass once Medium AI exists;
// - battlegrounds: option A's list for each era ("A, move with history"); the future era keeps Era 3's;
// - scoring: option A's weighted amounts, 20 steps to each end ("Weighted, 20, middle"); the start moved from the
//   middle to 7 steps towards SAE by the #515 balance pass (owner, 21 Nov: "Shift track start");
// - starting influence: Taiwan LIO 2, Crimea SAE 1, every other country empty (R24 "LIO 3 / SAE 1", then Taiwan
//   lowered to LIO 2 by the X15 balance pass, option 1, owner 29 Oct, #472).
// Its turns, plays per turn and hand size are the base game's (base-game.json; owner, 21 Nov 2026).
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/six-region-map.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const SIX_REGION_MAP_SCENARIO = scenarioSchema.parse(raw);
