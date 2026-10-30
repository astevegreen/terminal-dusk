// The Medium tier's weights, as plain data (docs/architecture.md, Decision 8).
// STARTING VALUES for the arena to tune (tools/balance/README.md, "Tiers").
import type { MediumWeights } from "../types.ts";

export const MEDIUM_WEIGHTS: MediumWeights = {
  /** Same as Easy: points for each action point on the card an answer names. */
  ops: 1,
  rivalCard: 0,
  /** Far less noise than Easy: Medium rarely plays loosely. */
  noise: 0.2,
  /** Points on the era-end region scoring table are what the game is decided by. */
  region: 3,
  /** A country on the way to being controlled is worth a share of what controlling it is worth. */
  progress: 2,
  battleground: 1,
  later: 0.5,
  /** A closed region's influence can no longer be removed by interventions or realignments. */
  closed: 1,
  /** A crisis moves the score track by the draw against its causer: a loss to avoid at nearly any price. */
  crisis: 10,
  /** Small: only tips a close choice, and only when Medium's own hand is safe. */
  trap: 1,
  /** Each step of lead is a step nearer Quantum Computing's era score and wins an even track's tie-break. */
  tech: 1,
  /** A first-there +1 makes the next attempt likelier; it is used up by that attempt, whatever its result. */
  techBonus: 0.5,
  /** Networks and Orbit: +1 in each realignment the side starts. Small: realignments are a share of its plays. */
  techRealign: 0.5,
  /** AI: +1 to each intervention's result. Small, as for realignments. */
  techIntervene: 0.5,
  /** Hypersonics: one more card play every turn, worth about a card's points. */
  techExtraPlay: 2,
  /** Quantum Computing: the rival picks its opening card first, face up. Its era score counts as a region point. */
  techOpening: 0.5,
};
