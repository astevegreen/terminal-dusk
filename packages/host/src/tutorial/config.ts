// The game a tutorial lesson coaches (#640; docs/design/tutorial.md): one real game on the six-region map, the
// learner as LIO, with the lesson's first cards stacked on the draw pile (Setup.deckTop, #637). The full edition
// plays the base game's numbers; the free edition plays the free game's (3 turns, no later era), so the engine
// itself ends a free player's tutorial after Era 1 scoring (owner, 27 Nov 2026).
import type { Lesson } from "@terminal-dusk/content";
import { era1FreeConfig, sixRegionMapConfig } from "../firstDeck.ts";
import type { MatchConfig } from "../types.ts";

/** Which game the learner owns: the Full Game, or the free game that stops at Era 1's end. */
export type TutorialEdition = "full" | "free";

/** The match config for `lesson` in `edition`: a fresh object each call, sharing nothing with the lesson. */
export function tutorialConfig(lesson: Lesson, edition: TutorialEdition): MatchConfig {
  const map = sixRegionMapConfig().setup;
  if (map.map === undefined) throw new Error("the six-region game has no map");
  const numbers = edition === "full" ? map : era1FreeConfig().setup;
  return {
    matchId: `tutorial-${lesson.id}`,
    players: { lio: "player-lio", sae: "player-sae" },
    setup: { ...numbers, map: map.map, deckTop: [...lesson.deckTop] },
  };
}
