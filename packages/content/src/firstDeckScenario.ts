// The TEST scenario for the first deck. Its hand size of 8 is the owner's (deck-plan.md, Owner question 27); its other
// numbers (turns, plays per turn) are placeholders, not design decisions.
import { scenarioSchema } from "../schema/scenario.ts";
import raw from "../scenarios/first-deck-test.json" with { type: "json" };

/** The scenario file, checked by the schema when this module loads. */
export const FIRST_DECK_SCENARIO = scenarioSchema.parse(raw);
