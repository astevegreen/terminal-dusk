// Test helper for leak checks, copying the idea of the host's test/leaks.ts. It reads the game state
// through MatchSecret["state"], so server code never names the engine's state type.
import { SIDES } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";

/**
 * What `text` gives away from `secret`: the seed, the generator state, each side's Contingency order, and
 * every card in a hand, the draw pile or an era still to enter (as a whole quoted string, so "l1" is not
 * set off by "l10").
 */
export function leaksIn(text: string, secret: MatchSecret): string[] {
  const state: MatchSecret["state"] = secret.state;
  const found: string[] = [];
  if (text.includes(JSON.stringify(secret.seed))) found.push("the seed");
  if (text.includes(JSON.stringify(state.secret.rng))) found.push("the generator state");
  for (const side of SIDES) {
    const order = state.secret.contingency[side];
    // An empty deck has no order to give away, and "[]" would match any empty list.
    if (order.length > 0 && text.includes(JSON.stringify(order))) found.push(`${side}'s Contingency order`);
  }
  const hidden = [
    ...state.secret.deck,
    ...state.secret.eras.flatMap((entry) => entry.cards),
    ...SIDES.flatMap((side) => state.private[side].hand),
  ];
  for (const card of hidden) if (text.includes(JSON.stringify(card))) found.push(`card ${JSON.stringify(card)}`);
  return found;
}
