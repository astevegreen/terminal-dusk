// Fixed games the fuzz suite replays, with every check, on every run. When a fuzz game fails, its report
// prints the game's record; once the bug is fixed, add that record here so the bug can't come back.
import type { GameRecord } from "./play.ts";

export const FIXED_GAMES: { name: string; record: GameRecord }[] = [
  {
    // Not a found failure: an example of the format, which also pins one order of a simultaneous pair.
    name: "example: SAE answers the opening pair before LIO",
    record: {
      setup: {
        seedHash: "hash-example",
        hands: { lio: ["c1", "c2", "c3"], sae: ["c10", "c11"] },
        deck: ["c4", "c5", "c6", "c7", "c8", "c9", "c12"],
        rounds: 1,
      },
      seed: "fixed-example",
      answers: [
        { decisionId: "d0-sae", side: "sae", value: { kind: "yesNo", yes: false } },
        { decisionId: "d0-lio", side: "lio", value: { kind: "yesNo", yes: true } },
        { decisionId: "d2", side: "lio", value: { kind: "pass" } },
        { decisionId: "d3", side: "sae", value: { kind: "pass" } },
      ],
    },
  },
];
