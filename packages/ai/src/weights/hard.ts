// The Hard tier's weights, as plain data (docs/architecture.md, Decision 8: "targets to tune, not promises").
// Tuned for issue #507 on six-region, Hard against Medium. A 1-round rollout costs about 15 ms (2 rounds about 33 ms),
// so 6 guesses x 4 answers finishes inside the app's 1.5 s on a PC and a 200-game arena run in about 20 minutes.
// Decision 8's 20 / 8 / 2 took about 78 s a game (about 4.4 h for the arena) and never finished inside 1.5 s.
import type { HardWeights } from "../types.ts";
import { MEDIUM_WEIGHTS } from "./medium.ts";

export const HARD_WEIGHTS: HardWeights = {
  /** The board is valued as Medium values it; Hard's edge is looking ahead, not a different taste. */
  ...MEDIUM_WEIGHTS,
  /** 6 guessed hidden hands. */
  guesses: 6,
  /** The best 4 of Medium's card answers are tried on each guess. */
  candidates: 4,
  /** A rollout plays 1 more card a side after the one being tried. */
  rounds: 1,
  /** The app's worker stops the search after 1.5 seconds (Decision 8: 1 to 2 s). */
  timeMs: 1500,
};
