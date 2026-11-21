// The optional 2025-2027 game (docs/design/eras.md, "Optional scenario: 2025–2027"): the base game plus one turn,
// 11 turns of 2 plays each with hands of 8, Era 2 entering on turn 4 and Era 3 on turn 6, and the future cards on
// turn 11. The future cards extend Era 3 (extendsEra), so Era 3 scores only once, at the end of 2027, and the final
// scoring and win check come then (owner, 21 Nov 2026). Data for now: no host config or screen starts it yet.
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/2025-2027.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const SCENARIO_2025_2027 = scenarioSchema.parse(raw);
