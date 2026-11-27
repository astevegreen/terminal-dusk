// The games against the AI the app ships: what each home screen button opens. Which of them a player gets depends on
// what they own; App's playerGames decides that (#686). Test mode and the tutorial build their own.
import {
  FIRST_DECK_NOTE,
  ERA_1_FREE_NOTE,
  SCENARIO_2025_2027_NOTE,
  SIX_REGION_MAP_NOTE,
  firstDeckCardName,
  firstDeckCardQuestion,
  firstDeckCardRules,
  era1FreeConfig,
  scenario2025To2027Config,
  firstDeckConfig,
  firstDeckRuleset,
  sixRegionMapConfig,
} from "@terminal-dusk/host/first-deck";
import { createLocalMatch } from "./transport/localMatch.ts";
import type { VsAiGame } from "./vsAi/VsAiScreen.tsx";

/** The game against the AI: the real first deck. */
const firstDeckGame: VsAiGame = {
  ruleset: firstDeckRuleset,
  makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, firstDeckConfig(), seed, clock),
  cardName: firstDeckCardName,
  cardQuestion: firstDeckCardQuestion,
  cardRules: firstDeckCardRules,
  cardAffiliation: (id) => firstDeckRuleset.cards.find((card) => card.id === id)?.affiliation,
  note: FIRST_DECK_NOTE,
};

/** `firstDeckGame` with another match config and the note above the side picker. */
function withConfig(config: () => ReturnType<typeof firstDeckConfig>, note: string): VsAiGame {
  return {
    ...firstDeckGame,
    makeMatch: (seed, clock) => createLocalMatch(firstDeckRuleset, config(), seed, clock),
    note,
  };
}

/**
 * The free game on the six-region map (#686): what a free player gets for the six-region map and the 2025-2027 game.
 * It is the free game's own config, so it ends where the free game ends, with only the map taken from the six-region
 * game, as the tutorial's config does (host's tutorial/config.ts).
 */
function era1FreeMapConfig(): ReturnType<typeof era1FreeConfig> {
  const free = era1FreeConfig();
  const { map } = sixRegionMapConfig().setup;
  if (map === undefined) throw new Error("the six-region config has no map");
  return { ...free, setup: { ...free.setup, map } };
}

const sixRegionNote = "on the six-region map (placeholder stabilities, battlegrounds and starting influence)";

export const appGames = {
  game: firstDeckGame,
  /** The first deck on the six-region map (A14, #439): the same cards, only the map is added. */
  mapGame: withConfig(sixRegionMapConfig, SIX_REGION_MAP_NOTE),
  /** The free player's game (L12, #575): Era 1's cards only, 3 turns. */
  freeGame: withConfig(era1FreeConfig, ERA_1_FREE_NOTE),
  freeMapGame: withConfig(era1FreeMapConfig, `${ERA_1_FREE_NOTE}, ${sixRegionNote}`),
  /** The optional 2025-2027 game (#601): the whole first deck plus the future cards on turn 11, on the six-region map. */
  futureGame: withConfig(scenario2025To2027Config, SCENARIO_2025_2027_NOTE),
};
