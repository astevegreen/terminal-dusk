// The Hard tier's weights, as plain data (docs/architecture.md, Decision 8).
// STARTING VALUES for the arena to tune (tools/balance/README.md, "Tiers").
import type { HardWeights } from "../types.ts";
import { MEDIUM_WEIGHTS } from "./medium.ts";

export const HARD_WEIGHTS: HardWeights = {
  /** The board is valued as Medium values it; Hard's edge is looking ahead, not a different taste. */
  ...MEDIUM_WEIGHTS,
  /** About 20 guessed hidden hands (Decision 8). */
  guesses: 20,
  /** The best 8 of Medium's card answers are tried on each guess. */
  candidates: 8,
  /** A rollout plays 2 more cards a side after the one being tried. */
  rounds: 2,
  /** The app's worker stops the search after 1.5 seconds (Decision 8: 1 to 2 s). */
  timeMs: 1500,
};
