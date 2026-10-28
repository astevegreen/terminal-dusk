// Turns a scenario file into the parts of the engine's Setup it decides. The engine hard-codes no deck;
// the default lives here (docs/design/contingency-deck.md, "The deck").
import type { Setup } from "@terminal-dusk/engine";
import type { Scenario } from "../schema/scenario.ts";

/** The Contingency deck a side, or the World deck, gets when the scenario names none: six cards numbered 1 to 6. */
export const DEFAULT_CONTINGENCY: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6]);

/** The scenario's own parts of a Setup. The caller adds the seed hash, the hands (empty) and the draw pile. */
export type ScenarioSetup = Pick<
  Setup,
  "turns" | "playsPerTurn" | "handSize" | "firstEra" | "eras" | "contingency" | "map"
>;

type ScenarioMap = NonNullable<Scenario["map"]>;

/** A fresh copy of the scenario's map: no array or object is shared with the scenario. `scoring` only when it has one. */
function copyMap(map: ScenarioMap): NonNullable<Setup["map"]> {
  const copy: NonNullable<Setup["map"]> = {
    regions: map.regions.map(({ id, name }) => ({ id, name })),
    closingOrder: [...map.closingOrder],
    countries: map.countries.map(({ id, name, region, stability, neighbours }) => ({
      id,
      name,
      region,
      stability,
      neighbours: [...neighbours],
    })),
    battlegrounds: map.battlegrounds.map(({ era, countries }) => ({ era, countries: [...countries] })),
    homeBox: { lio: [...map.homeBox.lio], sae: [...map.homeBox.sae] },
    startingInfluence: map.startingInfluence.map(({ country, lio, sae }) => ({ country, lio, sae })),
  };
  if (map.scoring !== undefined) {
    const { track, regions } = map.scoring;
    copy.scoring = {
      track: { end: track.end, start: track.start },
      regions: regions.map(({ region, present, ahead, all }) => ({ region, present, ahead, all })),
    };
  }
  return copy;
}

/**
 * The setup fields a scenario decides, as fresh arrays and objects. `firstEra`, `eras` and `map` are left out when
 * the scenario has none.
 */
export function scenarioSetup(scenario: Scenario): ScenarioSetup {
  const result: ScenarioSetup = {
    turns: scenario.turns,
    playsPerTurn: scenario.playsPerTurn,
    handSize: scenario.handSize,
    contingency: {
      lio: [...(scenario.contingency?.lio ?? DEFAULT_CONTINGENCY)],
      sae: [...(scenario.contingency?.sae ?? DEFAULT_CONTINGENCY)],
      world: [...(scenario.contingency?.world ?? DEFAULT_CONTINGENCY)],
    },
  };
  if (scenario.firstEra !== undefined) result.firstEra = scenario.firstEra;
  if (scenario.eras !== undefined) {
    result.eras = scenario.eras.map((entry) => ({ era: entry.era, turn: entry.turn, cards: [...entry.cards] }));
  }
  if (scenario.map !== undefined) result.map = copyMap(scenario.map);
  return result;
}
