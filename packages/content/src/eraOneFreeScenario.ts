// The free player's game against the AI (docs/design/eras.md, "The free player's game"): Era 1 only, as long as
// Era 1 in the base game, 3 turns, with 2 plays each per turn and hands of 8 (owner, 21 Nov 2026). The host starts it as
// era1FreeConfig and the home screen offers it (L12).
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/era-1-free.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const ERA_1_FREE_SCENARIO = scenarioSchema.parse(raw);
