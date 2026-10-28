// The first deck as a game the app can start: the ruleset, a match config, and card names and rules text.
// The app may not import content (docs/architecture.md), so this is the route from the real cards to the screens.
// There is no separate deal: both hands start empty and every Era 1 card starts in the draw pile, which the engine
// shuffles with the match seed. The turn 1 refill then deals each side its first hand (docs/design/core-loop.md,
// "Refilling hands").
import {
  ERA_1_CARDS,
  ERA_NAMES,
  FIRST_DECK_CARDS,
  FIRST_DECK_RULESET,
  FIRST_DECK_SCENARIO,
  cardName,
  scenarioSetup,
} from "@terminal-dusk/content/first-deck";
import { TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import type { CardId, EraId, Ruleset, Setup } from "@terminal-dusk/engine";
import type { MatchConfig } from "./types.ts";

export const FIRST_DECK_NOTE =
  "First deck, Eras 1 to 3 and the future cards (TEST scenario with placeholder numbers; they join on turns 2, 3 and 4)";
export const firstDeckRuleset: Ruleset = FIRST_DECK_RULESET;
export { cardName as firstDeckCardName };

/** An era's shown name, such as "Era 2 (2001–2008)"; an id the deck has no name for comes back as it is. */
export const firstDeckEraName = (era: EraId): string => (Object.hasOwn(ERA_NAMES, era) ? (ERA_NAMES[era] ?? era) : era);

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

/**
 * A fresh copy of R14's test map, starting influence included: TEST_MAP_SCENARIO through content's scenarioSetup.
 * Test data, not the game's map; the developer test mode plays on it. The first-deck config below has no map.
 */
export const firstDeckTestMap = (): NonNullable<Setup["map"]> => {
  const { map } = scenarioSetup(TEST_MAP_SCENARIO);
  if (map === undefined) throw new Error("the test map scenario has no map");
  return map;
};

/** The match config for the first deck: the TEST scenario's numbers, empty hands and the Era 1 draw pile. */
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
