// Test helper for leak checks against a whole MatchSecret, shared by the app's and the server's tests through
// "@terminal-dusk/host/test/secret-leaks" (#396). It reads the game state through MatchSecret["state"], so its
// callers never name the engine's state type (hard rule 2). The host's own tests use test/leaks.ts instead.
import { DECKS, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "../types.ts";

/** JSON with every object's keys sorted, so a database's key order never hides or fakes a difference. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** Whether `text` holds `value` as JSON, with its keys either sorted or in the state's own order. */
const holds = (text: string, value: unknown): boolean =>
  text.includes(JSON.stringify(value)) || text.includes(canonical(value));

/**
 * What `text` gives away from `secret`: the seed, the generator state, each Contingency deck's order, and
 * every card in a hand, the draw pile or an era still to enter (as a whole quoted string, so "l1" is not
 * set off by "l10").
 */
export function leaksIn(text: string, secret: MatchSecret): string[] {
  const state: MatchSecret["state"] = secret.state;
  const found: string[] = [];
  if (text.includes(JSON.stringify(secret.seed))) found.push("the seed");
  if (holds(text, state.secret.rng)) found.push("the generator state");
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
 * order, every card in the draw pile, an era still to enter or a rival's hand, every unrevealed pick of a
 * rival (its card, and the whole answer), a rival's knowledge (the cards it has been shown) and a rival's whole
 * private compartment. A side's own hand, picks and knowledge are not hidden from it; a spectator has none, so
 * both sides are its rivals. Objects are found whether or not `text` sorts their keys (`canonical`).
 */
export function leaksFor(text: string, secret: MatchSecret, viewer: Side | "spectator"): string[] {
  const state: MatchSecret["state"] = secret.state;
  const mine = viewer === "spectator" ? { hand: [], knowledge: [] } : state.private[viewer];
  // The viewer's own hand and its own knowledge (the rival's cards it has been shown) are not hidden from it.
  const own = new Set([...mine.hand, ...mine.knowledge]);
  const found = leaksIn(text, secret).filter((leak) => {
    const card = /^card "(.*)"$/.exec(leak)?.[1];
    return card === undefined || !own.has(card);
  });
  // A rival's picked card is not given away where it only shows in the viewer's own knowledge list.
  const shown = withoutKnowledge(text, mine.knowledge);
  for (const side of SIDES.filter((s) => s !== viewer)) {
    const rival = state.private[side];
    if (holds(text, rival)) found.push(`${side}'s private compartment`);
    // The cards in it are the viewer's own, so the list is looked for under its field name. The viewer's own
    // knowledge holds only the rival's cards, so it never matches a non-empty list of the viewer's.
    if (rival.knowledge.length > 0 && text.includes(`"knowledge":${JSON.stringify(rival.knowledge)}`)) {
      found.push(`${side}'s knowledge`);
    }
    for (const pick of rival.picks) {
      const { value } = pick;
      if (holds(text, value)) found.push(`${side}'s unrevealed pick`);
      if ("card" in value && shown.includes(JSON.stringify(value.card))) {
        found.push(`${side}'s unrevealed pick card ${JSON.stringify(value.card)}`);
      }
    }
  }
  return found;
}

/** A leak as the report may show it: what kind of thing leaked, never the card itself. */
export const withoutCards = (leak: string): string =>
  leak.replace(/ card "[^"]*"$/, " card").replace(/^card "[^"]*"$/, "a hidden card");
