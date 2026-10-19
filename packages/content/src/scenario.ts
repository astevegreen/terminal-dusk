// Turns a scenario file into the parts of the engine's Setup it decides. The engine hard-codes no deck;
// the default lives here (docs/design/contingency-deck.md, "The deck").
import type { Setup } from "@terminal-dusk/engine";
import type { Scenario } from "../schema/scenario.ts";

/** The Contingency deck a side gets when the scenario names none: six cards numbered 1 to 6. */
export const DEFAULT_CONTINGENCY: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6]);

/** The scenario's own parts of a Setup. The caller adds the seed hash, the hands (empty) and the draw pile. */
export type ScenarioSetup = Pick<Setup, "turns" | "playsPerTurn" | "handSize" | "eras" | "contingency">;

/** The setup fields a scenario decides, as fresh arrays. `eras` is left out when the scenario has none. */
export function scenarioSetup(scenario: Scenario): ScenarioSetup {
  const result: ScenarioSetup = {
    turns: scenario.turns,
    playsPerTurn: scenario.playsPerTurn,
    handSize: scenario.handSize,
    contingency: {
      lio: [...(scenario.contingency?.lio ?? DEFAULT_CONTINGENCY)],
      sae: [...(scenario.contingency?.sae ?? DEFAULT_CONTINGENCY)],
    },
  };
  if (scenario.eras !== undefined) {
    result.eras = scenario.eras.map((entry) => ({ era: entry.era, turn: entry.turn, cards: [...entry.cards] }));
  }
  return result;
}
