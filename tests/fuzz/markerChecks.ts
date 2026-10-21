// The fuzz checks for lasting markers and `has` conditions (R4a): a lasting marker is never lost, moved or
// duplicated, and every `has` reads the game so far. checkStep (checks.ts) runs them on every state.
import type { GameEvent, GameState } from "@terminal-dusk/engine";
import { branchOf, isLasting } from "./markers.ts";

/**
 * The lasting markers, `state.public.markers`, after one step. `before` is the list before the `apply`, or
 * null for the state createGame made, which must have none. After an `apply`: no label twice; `before` an
 * unchanged prefix; the labels added exactly those of this step's lasting marker `events` not already in
 * `before`, in the order of their first such event; and every lasting event's label in the list.
 */
export function checkMarkers(state: GameState, events: readonly GameEvent[], before: readonly string[] | null): void {
  const after = state.public.markers;
  const shown = JSON.stringify(after);
  if (before === null) {
    if (after.length > 0) throw new Error(`a new game already holds the lasting markers ${shown}`);
    return;
  }
  const twice = after.filter((label, i) => after.indexOf(label) !== i);
  if (twice.length > 0) throw new Error(`the lasting markers ${shown} hold ${JSON.stringify(twice)} more than once`);
  if (JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before)) {
    throw new Error(`the lasting markers ${shown} do not start with the ones before, ${JSON.stringify(before)}`);
  }
  const set = events.filter(isLasting).map((event) => event.label);
  const missing = set.filter((label) => !after.includes(label));
  if (missing.length > 0) {
    throw new Error(`lasting markers ${JSON.stringify(missing)} were set, but the lasting markers are ${shown}`);
  }
  const expected = set.filter((label, i) => set.indexOf(label) === i && !before.includes(label));
  const added = after.slice(before.length);
  if (JSON.stringify(added) !== JSON.stringify(expected)) {
    throw new Error(
      `the lasting markers added are ${JSON.stringify(added)}, but this step's lasting marker events ` +
        `add ${JSON.stringify(expected)}`,
    );
  }
}

/**
 * Every branch a `has "x"` took agrees with the game so far, read in event order across `allEvents` (all the
 * game's events, this step's included): "then" only after a lasting marker "x" event, "else" only before one.
 */
export function checkHasBranches(allEvents: readonly GameEvent[]): void {
  const set = new Set<string>();
  allEvents.forEach((event, i) => {
    if (isLasting(event)) set.add(event.label);
    const taken = branchOf(event);
    if (taken === null || taken.branch === (set.has(taken.label) ? "then" : "else")) return;
    const so = taken.branch === "then" ? "none had been set" : "one had been set earlier";
    throw new Error(`event ${i}: has "${taken.label}" took "${taken.branch}", but ${so}`);
  });
}
