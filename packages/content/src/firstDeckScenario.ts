// The base game with the first deck (docs/design/eras.md, "The base game"): 10 turns, 2 plays each per turn
// (docs/design/core-loop.md), Era 2 entering on turn 4 and Era 3 on turn 6 (owner, 21 Nov 2026), hands of 8
// (deck-plan.md, Owner question 27). The future cards belong to the optional 2025-2027 scenario, not to this one.
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/base-game.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const FIRST_DECK_SCENARIO = scenarioSchema.parse(raw);
