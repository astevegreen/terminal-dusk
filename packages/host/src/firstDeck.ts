// The first deck as a game the app can start: the ruleset, a match config, and card names and rules text.
// The app may not import content (docs/architecture.md), so this is the route from the real cards to the screens.
// There is no separate deal: both hands start empty and every Era 1 card starts in the draw pile, which the engine
// shuffles with the match seed. The turn 1 refill then deals each side its first hand (docs/design/core-loop.md,
// "Refilling hands").
import {
  ERA_1_CARDS,
  ERA_NAMES,
  ERA_TITLES,
  FIRST_DECK_CARDS,
  FIRST_DECK_RULESET,
  ERA_1_FREE_SCENARIO,
  FIRST_DECK_SCENARIO,
  SCENARIO_2025_2027,
  cardName,
  scenarioSetup,
} from "@terminal-dusk/content/first-deck";
import { SIX_REGION_MAP_SCENARIO, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import type { CardId, EraId, Ruleset, Setup } from "@terminal-dusk/engine";
import type { MatchConfig } from "./types.ts";

const lookUp = (names: Readonly<Record<EraId, string>>, era: EraId): string =>
  Object.hasOwn(names, era) ? (names[era] ?? era) : era;
/** An era's shown name, such as "The Shock (Era 2, 2001–2008)"; an id with no name comes back as it is. */
export const firstDeckEraName = (era: EraId): string => lookUp(ERA_NAMES, era);
/** The same without the years, such as "The Shock (Era 2)", for where there is no room for them. */
export const firstDeckEraTitle = (era: EraId): string => lookUp(ERA_TITLES, era);

const ERA_1 = firstDeckEraTitle("era-1");
const ERA_2 = firstDeckEraTitle("era-2");
const ERA_3 = firstDeckEraTitle("era-3");

/** The home screen's button for the free game (L12). */
export const ERA_1_FREE_BUTTON = `Play the free game: ${ERA_1}`;
export const FIRST_DECK_NOTE = `First deck, the base game: 10 turns. ${ERA_1} starts, ${ERA_2} joins on turn 4, ${ERA_3} on turn 6`;
export const ERA_1_FREE_NOTE = `The free game: ${firstDeckEraName("era-1")} only, 3 turns`;
export const SCENARIO_2025_2027_NOTE = `The 2025-2027 game: 11 turns, the future cards join on turn 11, ${ERA_3} scores once at the end of 2027`;
export const SIX_REGION_MAP_NOTE =
  "First deck on the six-region map (placeholder stabilities, battlegrounds and starting influence)";
export const firstDeckRuleset: Ruleset = FIRST_DECK_RULESET;
export { cardName as firstDeckCardName };

const ASKS = "chooses: ";
/** The question in a card's rules text: after "chooses: ", up to and including the first "?". */
function questionIn(rules: string): string | undefined {
  const start = rules.indexOf(ASKS);
  if (start < 0) return undefined;
  const end = rules.indexOf("?", start);
  return end < 0 ? undefined : rules.slice(start + ASKS.length, end + 1);
}
const QUESTIONS = new Map<CardId, string | undefined>(
  FIRST_DECK_CARDS.map((card) => [card.id, questionIn(card.text.rules)]),
);

/**
 * The yes/no question a first-deck card asks, taken from its rules text (docs/design/cards/deck-plan.md: "the
 * question is the rules text"). Undefined for a card that asks nothing or an unknown id. Display data only.
 */
export const firstDeckCardQuestion = (id: CardId): string | undefined => QUESTIONS.get(id);

const RULES = new Map<CardId, string>(FIRST_DECK_CARDS.map((card) => [card.id, card.text.rules]));

/** A first-deck card's rules text as its card file has it, shown under its name; undefined for an unknown id. */
export const firstDeckCardRules = (id: CardId): string | undefined => RULES.get(id);

/** A fresh copy of a scenario's map, starting influence included, through content's scenarioSetup. */
function mapOf(scenario: typeof TEST_MAP_SCENARIO): NonNullable<Setup["map"]> {
  const { map } = scenarioSetup(scenario);
  if (map === undefined) throw new Error(`the ${scenario.id} scenario has no map`);
  return map;
}

/**
 * A fresh copy of R14's test map, starting influence included: TEST_MAP_SCENARIO through content's scenarioSetup.
 * Test data, not the game's map; the developer test mode plays on it. The first-deck config below has no map.
 */
export const firstDeckTestMap = (): NonNullable<Setup["map"]> => mapOf(TEST_MAP_SCENARIO);

/** The match config for the first deck: the base game's numbers, empty hands and the Era 1 draw pile. */
export function firstDeckConfig(): MatchConfig {
  return {
    matchId: "first-deck",
    players: { lio: "player-lio", sae: "player-sae" },
    setup: {
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(FIRST_DECK_SCENARIO),
    },
  };
}

/**
 * The free player's game (L12, #575; docs/design/eras.md): the Era 1 draw pile and the free scenario's numbers, so 3
 * turns with no later era entering. Everything else is the first deck's.
 */
export function era1FreeConfig(): MatchConfig {
  return {
    matchId: "era-1-free",
    players: { lio: "player-lio", sae: "player-sae" },
    setup: {
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(ERA_1_FREE_SCENARIO),
    },
  };
}

/**
 * The first deck on the six-region map (A14, #439): firstDeckConfig with only the map taken from the six-region
 * scenario. Turns, plays, hand size and eras stay the first deck's, because that scenario has no eras.
 */
export function sixRegionMapConfig(): MatchConfig {
  const config = firstDeckConfig();
  return { ...config, matchId: "six-region-map", setup: { ...config.setup, map: mapOf(SIX_REGION_MAP_SCENARIO) } };
}

/** Whether the map's "future" battleground list is Era 3's, in any order; false when either list is missing. */
export function futureBattlegroundsMatchEra3(map: NonNullable<Setup["map"]>): boolean {
  const list = (era: string) => map.battlegrounds.find((b) => b.era === era)?.countries;
  const future = list("future");
  const era3 = list("era-3");
  if (future === undefined || era3 === undefined) return false;
  return future.length === era3.length && future.toSorted().join() === era3.toSorted().join();
}

/**
 * The optional 2025-2027 game (#601; docs/design/eras.md): the scenario's 11 turns and eras, with the future cards
 * entering on turn 11 and extending Era 3, on the six-region map as the base game is played (or on `map`, which the
 * balance tool gives with its own numbers). Era 3 scores once, at the end of turn 11, from the map's "future"
 * battleground list, so a map whose list is not Era 3's is refused.
 */
export function scenario2025To2027Config(map = mapOf(SIX_REGION_MAP_SCENARIO)): MatchConfig {
  if (!futureBattlegroundsMatchEra3(map)) throw new Error("the map's future battlegrounds must be Era 3's");
  return {
    matchId: "2025-2027",
    players: { lio: "player-lio", sae: "player-sae" },
    setup: {
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(SCENARIO_2025_2027),
      map,
    },
  };
}

// The engine's pure helper for which regions Escalation has closed, for the app's Escalation display (A15): the engine's
// own comment says the app may call it on a view's public part, and the app's boundary check lets it import the host.
export { closedRegions } from "@terminal-dusk/engine";
// Likewise which countries are battlegrounds in the current era, for the drawn map's markers (L2, #465).
export { isBattleground } from "@terminal-dusk/engine";
// Likewise each side's level and points in a region if it scored now, for the map's standings chips (L8, #488).
export { regionStanding } from "@terminal-dusk/engine";
