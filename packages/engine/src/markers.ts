// Lasting markers: named tags a card leaves in the public state until the game ends, which a later
// card's `has` condition tests. Nothing removes one: turn ends, eras, refills and reshuffles keep them.
import type { GameState } from "./types.ts";

/** Keeps `label` among the lasting markers, after the ones already set; a label already there stays put. */
export function keepMarker(state: GameState, label: string): void {
  if (!state.public.markers.includes(label)) state.public.markers.push(label);
}

/** True when a lasting marker labelled `label` has been set in this game, by any card of any side. */
export const hasMarker = (state: GameState, label: string): boolean => state.public.markers.includes(label);
