// Test helper for leak checks, copying the idea of the host's test/leaks.ts. It reads the game state
// through MatchSecret["state"], so server code never names the engine's state type.
import { SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
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

/**
 * What `text` gives away that `viewer` may not see: the seed, the generator state, each side's Contingency
 * order, every card in the draw pile, an era still to enter or another side's hand, and every unrevealed
 * pick of another side (its card, and the whole answer). A side's own hand and picks are not hidden from it.
 */
export function leaksFor(text: string, secret: MatchSecret, viewer: Side | "spectator"): string[] {
  const state: MatchSecret["state"] = secret.state;
  const others = SIDES.filter((side) => side !== viewer);
  const ownHands = new Set(SIDES.filter((side) => side === viewer).flatMap((side) => state.private[side].hand));
  const found = leaksIn(text, secret).filter((leak) => {
    const card = /^card "(.*)"$/.exec(leak)?.[1];
    return card === undefined || !ownHands.has(card);
  });
  for (const side of others) {
    for (const pick of state.private[side].picks) {
      const { value } = pick;
      if (text.includes(JSON.stringify(value))) found.push(`${side}'s unrevealed pick`);
      if ("card" in value && text.includes(JSON.stringify(value.card))) {
        found.push(`${side}'s unrevealed pick card ${JSON.stringify(value.card)}`);
      }
    }
  }
  return found;
}
