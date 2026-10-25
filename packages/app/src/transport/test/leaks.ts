// Test helper for the phase 4 rehearsal's leak checks, the same idea as the server's and the host's
// test/leaks.ts. It reads the game state through MatchSecret["state"], so app code never names the engine's
// state type (hard rule 2).
import { DECKS, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";

/**
 * What `text` gives away from `secret`: the seed, the generator state, each Contingency deck's order, and
 * every card in a hand, the draw pile or an era still to enter (as a whole quoted string, so "l1" is not
 * set off by "l10").
 */
function leaksIn(text: string, secret: MatchSecret): string[] {
  const state: MatchSecret["state"] = secret.state;
  const found: string[] = [];
  if (text.includes(JSON.stringify(secret.seed))) found.push("the seed");
  if (text.includes(canonical(state.secret.rng))) found.push("the generator state");
  for (const deck of DECKS) {
    const order = state.secret.contingency[deck];
    const name = deck === "world" ? "the World deck's order" : `${deck}'s Contingency order`;
    // An empty deck has no order to give away, and "[]" would match any empty list.
    if (order.length > 0 && text.includes(JSON.stringify(order))) found.push(name);
  }
  const hidden = [
    ...state.secret.deck,
    ...state.secret.eras.flatMap((entry) => entry.cards),
    ...SIDES.flatMap((side) => state.private[side].hand),
  ];
  for (const card of hidden) if (text.includes(JSON.stringify(card))) found.push(`card ${JSON.stringify(card)}`);
  return found;
}

/** JSON with every object's keys sorted, so a database's key order never hides or fakes a difference. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * What `text` gives away that `viewer` may not see: the seed, the generator state, each side's Contingency
 * order, every card in the draw pile, an era still to enter or the rival's hand, every unrevealed pick of
 * the rival (its card, and the whole answer), the rival's knowledge (the viewer's cards it has been shown) and
 * the rival's whole private compartment. A side's own hand, picks and knowledge are not hidden from it.
 * `text` should be compact JSON with sorted keys (`canonical`), so objects are found whatever their key order.
 */
export function leaksFor(text: string, secret: MatchSecret, viewer: Side): string[] {
  const state: MatchSecret["state"] = secret.state;
  const ownHand = new Set(state.private[viewer].hand);
  const found = leaksIn(text, secret).filter((leak) => {
    const card = /^card "(.*)"$/.exec(leak)?.[1];
    return card === undefined || !ownHand.has(card);
  });
  for (const side of SIDES.filter((s) => s !== viewer)) {
    const rival = state.private[side];
    if (text.includes(canonical(rival))) found.push(`${side}'s private compartment`);
    // The cards in it are the viewer's own, so the list is looked for under its field name. The viewer's own
    // knowledge holds only the rival's cards, so it never matches a non-empty list of the viewer's.
    if (rival.knowledge.length > 0 && text.includes(`"knowledge":${canonical(rival.knowledge)}`)) {
      found.push(`${side}'s knowledge`);
    }
    for (const pick of rival.picks) {
      const { value } = pick;
      if (text.includes(canonical(value))) found.push(`${side}'s unrevealed pick`);
      if ("card" in value && text.includes(JSON.stringify(value.card))) {
        found.push(`${side}'s unrevealed pick card ${JSON.stringify(value.card)}`);
      }
    }
  }
  return found;
}

/** A leak as the report may show it: what kind of thing leaked, never the card itself. */
export const withoutCards = (leak: string): string =>
  leak.replace(/ card "[^"]*"$/, " card").replace(/^card "[^"]*"$/, "a hidden card");
