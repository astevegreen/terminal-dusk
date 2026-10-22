// The run's match config: the first-deck TEST scenario, with the turns, plays per turn and era arrival turns the
// command line asked for. Only this run's config changes; the scenario file, the hand size and the cards do not.
// The game rules about eras (turn 2 or later, not after the last turn, one era per turn) stay with the host.
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";

/** The first era: its cards are in the draw pile from turn 1, so it cannot be moved or left out. */
export const FIRST_ERA = "era-1";
/** Every era the first-deck setup has, first era first, the later ones in the setup's order. */
export const ERA_IDS = [FIRST_ERA, ...(firstDeckConfig().setup.eras ?? []).map((entry) => entry.era)];

/**
 * The match config for a run. `turns` and `plays` replace the scenario's numbers when given; `eras` maps an era id
 * to its new arrival turn, or to null to leave its cards out. Eras not named keep the scenario's turns.
 */
export function balanceConfig({ turns, plays, eras = {} } = {}) {
  const config = firstDeckConfig();
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
 * The numbers a config actually uses: turns, plays per turn, and each era's arrival turn (null when left out),
 * keyed by era id in ERA_IDS order.
 */
export function setupNumbers(config) {
  const { turns, playsPerTurn, eras = [] } = config.setup;
  const arrival = (id) => (id === FIRST_ERA ? 1 : (eras.find((entry) => entry.era === id)?.turn ?? null));
  return { turns, playsPerTurn, eras: Object.fromEntries(ERA_IDS.map((id) => [id, arrival(id)])) };
}

/**
 * The era information for balanceStats: for each era, its card ids taken from the ruleset (`card.era`), or null
 * when the run leaves it out.
 */
export function eraCards(numbers, ruleset = firstDeckRuleset) {
  return ERA_IDS.map((era) => ({
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
