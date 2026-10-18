// Test helpers for leak checks, copying the idea of tests/fuzz/checks.ts (hiddenFrom, leaksIn).
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, GameState, Seed, Viewer } from "@terminal-dusk/engine";

/** The card IDs `viewer` may not see: the draw pile, the eras still to enter, and every hand but the viewer's own. */
export function hiddenFrom(state: GameState, viewer: Viewer): CardId[] {
  const hands = SIDES.filter((side) => side !== viewer).flatMap((side) => state.private[side].hand);
  const waiting = state.secret.eras.flatMap((entry) => entry.cards);
  return [...state.secret.deck, ...waiting, ...hands];
}

/**
 * What `text` gives away: the seed and each card in `hidden` as a whole quoted JSON string, so "c1"
 * is not set off by "c10", and the generator state by its exact JSON text.
 */
export function leaksIn(text: string, seed: Seed, state: GameState, hidden: readonly CardId[]): string[] {
  const found: string[] = [];
  if (text.includes(JSON.stringify(seed))) found.push("the seed");
  if (text.includes(JSON.stringify(state.secret.rng))) found.push("the generator state");
  for (const card of hidden) if (text.includes(JSON.stringify(card))) found.push(`card ${JSON.stringify(card)}`);
  return found;
}
