// The tech race's types (docs/design/tech-race.md). types.ts re-exports them, so index.ts exports the same names.
import type { Side } from "./types.ts";

/** One step of the tech race track: its name, the same for both sides, and what moving onto it costs (1 or more). */
export type TechStep = { name: string; cost: number };

/**
 * A map's tech race track (scenario data): `steps` from parity outwards, the track running `steps.length` steps each
 * way; `success`, the lowest draw (bonus included) that moves the marker; and `escalateAt`, the step whose entry on a
 * side's own attempt, moving away from parity, raises Escalation by 1 (Hypersonics, step 3). All whole numbers.
 */
export type MapTechRace = { steps: TechStep[]; success: number; escalateAt: number };

/**
 * The tech race in public state, present exactly when `map.techRace` is. `marker` is the one shared marker, a whole
 * number from -steps (LIO's end) through 0 (parity) to +steps (SAE's end), like the score track; it never resets.
 * `attempted`: the sides that have made their one attempt this turn, in SIDES order. `reached`: the steps (1 = the
 * first from parity) some side has reached in this game, ascending, each once. `bonus`: the sides whose next attempt
 * draws +1 for reaching a step first, in SIDES order.
 */
export type TechRaceState = { marker: number; attempted: Side[]; reached: number[]; bonus: Side[] };

/**
 * One tech race attempt: `side` spent `points` (at least `cost`) and drew `draw` from its own Contingency deck, plus
 * `bonus` (1 for reaching a step first earlier, else 0). The marker went from `from` to `to`: one step on a success,
 * unchanged on a failure. `first` is true when this move reached a step first in the game, earning the next +1.
 */
export type TechRaceAttempted = {
  kind: "techRaceAttempted";
  visibility: "public";
  side: Side;
  points: number;
  cost: number;
  draw: number;
  bonus: number;
  from: number;
  to: number;
  first: boolean;
};
