// The run's match config: the chosen scenario (the first-deck TEST scenario, or the test map scenario with the first
// deck's Era 1 cards), with the turns, plays per turn and era arrival turns the command line asked for. Only this
// run's config changes; the scenario files, the hand size and the cards do not. The game rules about eras (turn 2 or
// later, not after the last turn, one era per turn) stay with the host.
import { scenarioSetup, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";

/** The first era: its cards are in the draw pile from turn 1, so it cannot be moved or left out. */
export const FIRST_ERA = "era-1";
/** The scenarios a run can play, the default first. */
export const SCENARIOS = ["first-deck", "test-map"];
export const DEFAULT_SCENARIO = SCENARIOS[0];

/**
 * A fresh match config of `scenario` as its file has it. "test-map" is the first deck's config (empty hands, the
 * Era 1 draw pile) with the test map scenario's own numbers, map and starting influence in place of the TEST
 * scenario's (content's scenarioSetup); that scenario has no later eras, so only Era 1 cards play.
 */
export function scenarioConfig(scenario = DEFAULT_SCENARIO) {
  const config = firstDeckConfig();
  if (scenario === "first-deck") return config;
  if (scenario !== "test-map") throw new Error(`Unknown scenario "${scenario}".`);
  const { hands, deck } = config.setup;
  return { ...config, matchId: "test-map", setup: { hands, deck, ...scenarioSetup(TEST_MAP_SCENARIO) } };
}

/** Every era `scenario` has, first era first, the later ones in the scenario's order. */
export const eraIdsOf = (scenario = DEFAULT_SCENARIO) => [
  FIRST_ERA,
  ...(scenarioConfig(scenario).setup.eras ?? []).map((entry) => entry.era),
];
/** Every era the first-deck setup has (the default scenario's eras). */
export const ERA_IDS = eraIdsOf(DEFAULT_SCENARIO);

/**
 * The match config for a run of `scenario`. `turns` and `plays` replace the scenario's numbers when given; `eras`
 * maps an era id to its new arrival turn, or to null to leave its cards out. Eras not named keep the scenario's turns.
 */
export function balanceConfig({ scenario = DEFAULT_SCENARIO, turns, plays, eras = {} } = {}) {
  const config = scenarioConfig(scenario);
  const setup = config.setup;
  if (turns !== undefined) setup.turns = turns;
  if (plays !== undefined) setup.playsPerTurn = plays;
  if (setup.eras !== undefined) {
    setup.eras = setup.eras
      .filter((entry) => eras[entry.era] !== null)
      .map((entry) => (eras[entry.era] === undefined ? entry : { ...entry, turn: eras[entry.era] }));
  }
  return config;
}

/**
 * The numbers a config of `scenario` actually uses: turns, plays per turn, and each era's arrival turn (null when
 * left out), keyed by era id in the scenario's era order.
 */
export function setupNumbers(config, scenario = DEFAULT_SCENARIO) {
  const { turns, playsPerTurn, eras = [] } = config.setup;
  const arrival = (id) => (id === FIRST_ERA ? 1 : (eras.find((entry) => entry.era === id)?.turn ?? null));
  return { turns, playsPerTurn, eras: Object.fromEntries(eraIdsOf(scenario).map((id) => [id, arrival(id)])) };
}

/**
 * The era information for balanceStats: for each era, its card ids taken from the ruleset (`card.era`), or null
 * when the run leaves it out.
 */
export function eraCards(numbers, ruleset = firstDeckRuleset) {
  return Object.keys(numbers.eras).map((era) => ({
    era,
    cards: numbers.eras[era] === null ? null : ruleset.cards.filter((card) => card.era === era).map((card) => card.id),
  }));
}

/** The setup part of the report title, for example "4 turns, 1 play per turn, era-1 on turn 1, era-3 left out". */
export function describeSetup(numbers) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const eras = Object.entries(numbers.eras).map(([era, turn]) =>
    turn === null ? `${era} left out` : `${era} on turn ${turn}`,
  );
  return [plural(numbers.turns, "turn"), `${plural(numbers.playsPerTurn, "play")} per turn`, ...eras].join(", ");
}
