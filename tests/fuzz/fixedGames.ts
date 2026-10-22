// Fixed games the fuzz suite replays, with every check, on every run. When a fuzz game fails, its report
// prints the game's record; once the bug is fixed, add that record here so the bug can't come back.
import type { GameRecord } from "./play.ts";

export const FIXED_GAMES: { name: string; record: GameRecord }[] = [
  {
    // Not a found failure: an example of the format, which also pins one order of a simultaneous pair.
    // SAE's c5 (4 ops) resolves before LIO's c1 (0 ops); then LIO plays its c7 for its event and SAE
    // its c2 for its points.
    name: "example: SAE picks its opening card before LIO",
    record: {
      setup: {
        seedHash: "1fd8eb26858a1e8304ab35b040df3efd3a186f375855f61db6212c2f2271ef71",
        hands: { lio: ["c1", "c7"], sae: ["c2", "c5"] },
        deck: ["c3", "c6", "c9", "c12"],
        turns: 1,
        playsPerTurn: 1,
        handSize: 2,
        contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
      },
      seed: "fixed-example",
      answers: [
        { decisionId: "d0-sae", side: "sae", value: { kind: "chooseCard", card: "c5" } },
        { decisionId: "d0-lio", side: "lio", value: { kind: "chooseCard", card: "c1" } },
        { decisionId: "d2", side: "lio", value: { kind: "playCardAs", card: "c7", as: "event" } },
        { decisionId: "d3", side: "sae", value: { kind: "playCardAs", card: "c2", as: "points" } },
      ],
    },
  },
];
