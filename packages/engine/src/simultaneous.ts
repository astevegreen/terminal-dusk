// Simultaneous decisions: both sides answer at once and in secret. Each answer waits in the answering
// side's private compartment, as its own unrevealed pick, until the other side's is in. Then both are
// revealed together, in SIDES order, whichever arrived first.
import { SIDES } from "./types.ts";
import type { AnswerValue, Decision, GameState, Side } from "./types.ts";

/** Both answers to a simultaneous group, keyed by side. */
export type Revealed = Record<Side, AnswerValue>;

/**
 * Closes `decision`, one of `group`, and keeps `value` as its side's unrevealed pick. Returns null while
 * the other side has still to answer. Once both have, clears both picks and returns both answers, keyed
 * by side in SIDES order. Edits `state`, a working copy, in place.
 */
export function recordPick(state: GameState, decision: Decision, group: string, value: AnswerValue): Revealed | null {
  state.public.pending = state.public.pending.filter((d) => d.id !== decision.id);
  state.private[decision.side].picks.push({ group, decisionId: decision.id, value });
  if (state.public.pending.some((d) => d.simultaneousGroup === group)) return null;
  const lio = takePick(state, "lio", group);
  const sae = takePick(state, "sae", group);
  // Keys in SIDES order, so nothing revealed shows which side answered first.
  return lio && sae ? { lio, sae } : null;
}

/** True while any side holds a pick that is not yet revealed, so a group is half answered. */
export const halfAnswered = (state: GameState): boolean => SIDES.some((side) => state.private[side].picks.length > 0);

/** Removes `side`'s pick in `group` from its private compartment and returns the answer it held. */
function takePick(state: GameState, side: Side, group: string): AnswerValue | undefined {
  const mine = state.private[side];
  const pick = mine.picks.find((p) => p.group === group);
  mine.picks = mine.picks.filter((p) => p.group !== group);
  return pick?.value;
}
