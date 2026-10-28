// The Escalation track (docs/design/map-and-points.md, "Escalation"): one shared public number from 0 to 6, in a
// game with a map only. It starts at 2, falls by 1 at the end of each turn (turn.ts), and reaching 6 is a crisis:
// the side that caused it draws one card from its own Contingency deck and loses that many points of score (on a map
// with scoring), and Escalation drops to 3. Interventions (R16b) and cards (R18) will call the raise and lower below.
import { drawContingency } from "./contingency.ts";
import { moveScore } from "./scoring.ts";
import type { GameEvent, GameState, Side } from "./types.ts";

/** Where a game with a map starts the track. */
export const ESCALATION_START = 2;
/** The track's ends: it stops at both. */
export const ESCALATION_MIN = 0;
export const ESCALATION_MAX = 6;
/** Where Escalation drops to after a crisis. */
export const AFTER_CRISIS = 3;

/** Sets Escalation to `to`, with its escalationChanged event, unless it is already there. */
function moveTo(state: GameState, to: number, events: GameEvent[]): void {
  const from = state.public.escalation!;
  if (from === to) return;
  state.public.escalation = to;
  events.push({ kind: "escalationChanged", visibility: "public", from, to });
}

/**
 * Raises Escalation by `by` (a whole number, 1 or more), stopping at 6, because of `causer`. Reaching 6 is a
 * crisis: `causer` draws from its own Contingency deck (an ordinary draw), an escalationCrisis event names it and
 * the number drawn, the score track moves that far towards the rival (moveScore), and Escalation drops to 3. A move
 * that reaches the rival's end ends the game at once, with Escalation left at 6. Does nothing in a game without a
 * map. Edits `state`, apply's working copy, in place, like drawContingency.
 */
export function raiseEscalation(state: GameState, by: number, causer: Side, events: GameEvent[]): void {
  const now = state.public.escalation;
  if (now === undefined) return;
  moveTo(state, Math.min(ESCALATION_MAX, now + by), events);
  if (state.public.escalation !== ESCALATION_MAX) return;
  const value = drawContingency(state, causer, events);
  events.push({ kind: "escalationCrisis", visibility: "public", side: causer, value });
  if (moveScore(state, causer === "lio" ? value : -value, events)) return;
  moveTo(state, AFTER_CRISIS, events);
}

/**
 * Lowers Escalation by `by` (a whole number, 1 or more), stopping at 0. A fall has no cause. Does nothing in a game
 * without a map. Edits `state` in place.
 */
export function lowerEscalation(state: GameState, by: number, events: GameEvent[]): void {
  const now = state.public.escalation;
  if (now === undefined) return;
  moveTo(state, Math.max(ESCALATION_MIN, now - by), events);
}
