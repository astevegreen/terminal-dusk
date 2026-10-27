// Test helper for leak checks, copying the idea of the host's test/leaks.ts. It reads the game state
// through MatchSecret["state"], so server code never names the engine's state type.
import { DECKS, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";

/**
 * What `text` gives away from `secret`: the seed, the generator state, each Contingency deck's order, and
 * every card in a hand, the draw pile or an era still to enter (as a whole quoted string, so "l1" is not
 * set off by "l10").
 */
export function leaksIn(text: string, secret: MatchSecret): string[] {
  const state: MatchSecret["state"] = secret.state;
  const found: string[] = [];
  if (text.includes(JSON.stringify(secret.seed))) found.push("the seed");
  if (text.includes(JSON.stringify(state.secret.rng))) found.push("the generator state");
  const unlisted = withoutPublicLists(text, state);
  for (const deck of DECKS) {
    const order = state.secret.contingency[deck];
    const name = deck === "world" ? "the World deck's order" : `${deck}'s Contingency order`;
    // An empty deck has no order to give away, and "[]" would match any empty list.
    if (order.length > 0 && unlisted.includes(JSON.stringify(order))) found.push(name);
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
 * `text` with every deck's public `cards` and `left` lists, under the deck's name, emptied. They are public and
 * sorted, so a hidden order that happens to be ascending can equal one of them by chance (#380).
 */
function withoutPublicLists(text: string, state: MatchSecret["state"]): string {
  return DECKS.reduce((rest, deck) => {
    const { cards, left } = state.public.contingency[deck];
    return rest.replaceAll(`"${deck}":${JSON.stringify({ cards, left })}`, `"${deck}":{"cards":[],"left":[]}`);
  }, text);
}

/** `text` with the viewer's own `knowledge` list emptied: the rival's cards it was legitimately shown (#379). */
function withoutKnowledge(text: string, knowledge: readonly string[]): string {
  return knowledge.length === 0 ? text : text.replaceAll(`"knowledge":${JSON.stringify(knowledge)}`, '"knowledge":[]');
}

/**
 * What `text` gives away that `viewer` may not see: the seed, the generator state, each side's Contingency
 * order, every card in the draw pile, an era still to enter or another side's hand, and every unrevealed
 * pick of another side (its card, and the whole answer). A side's own hand, picks and knowledge (the rival's
 * cards it has been shown) are not hidden from it; a spectator has none.
 */
export function leaksFor(text: string, secret: MatchSecret, viewer: Side | "spectator"): string[] {
  const state: MatchSecret["state"] = secret.state;
  const others = SIDES.filter((side) => side !== viewer);
  const knowledge = viewer === "spectator" ? [] : state.private[viewer].knowledge;
  const own = new Set([...(viewer === "spectator" ? [] : state.private[viewer].hand), ...knowledge]);
  const found = leaksIn(text, secret).filter((leak) => {
    const card = /^card "(.*)"$/.exec(leak)?.[1];
    return card === undefined || !own.has(card);
  });
  // A rival's picked card is not given away where it only shows in the viewer's own knowledge list.
  const shown = withoutKnowledge(text, knowledge);
  for (const side of others) {
    for (const pick of state.private[side].picks) {
      const { value } = pick;
      if (text.includes(JSON.stringify(value))) found.push(`${side}'s unrevealed pick`);
      if ("card" in value && shown.includes(JSON.stringify(value.card))) {
        found.push(`${side}'s unrevealed pick card ${JSON.stringify(value.card)}`);
      }
    }
  }
  return found;
}
