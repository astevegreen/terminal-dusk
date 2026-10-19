// The first deck as a game the app can start: the ruleset, a match config, and card names.
// The app may not import content (docs/architecture.md), so this is the route from the real cards to the screens.
// There is no separate deal: both hands start empty and every Era 1 card starts in the draw pile, which the engine
// shuffles with the match seed. The turn 1 refill then deals each side its first hand (docs/design/core-loop.md,
// "Refilling hands").
import {
  ERA_1_CARDS,
  FIRST_DECK_RULESET,
  FIRST_DECK_SCENARIO,
  cardName,
  scenarioSetup,
} from "@terminal-dusk/content/first-deck";
import type { Ruleset } from "@terminal-dusk/engine";
import type { MatchConfig } from "./types.ts";

export const FIRST_DECK_NOTE =
  "First deck, Eras 1 to 3 and the future cards (TEST scenario with placeholder numbers; they join on turns 2, 3 and 4)";
export const firstDeckRuleset: Ruleset = FIRST_DECK_RULESET;
export { cardName as firstDeckCardName };

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
