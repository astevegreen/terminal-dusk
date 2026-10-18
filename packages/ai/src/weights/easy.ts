// The Easy tier's weights, as plain data (docs/architecture.md, Decision 8).
// These are STARTING VALUES for the arena to tune; nothing here has been tested against real play yet.
import type { Weights } from "../types.ts";

export const EASY_WEIGHTS: Weights = {
  /** Points for each action point on the card an answer names. */
  ops: 1,
  /** Points for naming the rival's card; below zero would avoid them. */
  rivalCard: 0,
  /** The most random noise added to any answer's score. Large enough that Easy often plays loosely. */
  noise: 2,
};
