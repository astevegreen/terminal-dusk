// A stacked top of the draw pile for scripted scenarios such as the tutorial (#637; docs/architecture.md,
// Decision 4, "Tutorial"). `Setup.deckTop` lists the first cards drawn, in order. Only those cards are known: the
// rest of the deck is shuffled by the seeded generator exactly as a deck without them would be, so no seed goes
// into content and the rest of the match stays secret.
import { shuffle } from "./rng.ts";
import type { RngState } from "./rng.ts";
import type { CardId, EngineError, Setup } from "./types.ts";

/** Why `setup.deckTop` is not a list of distinct cards from `setup.deck`, or null. Left out is fine. */
export function deckTopError(setup: Setup): EngineError | null {
  const top: unknown = setup.deckTop;
  if (top === undefined) return null;
  if (!Array.isArray(top) || !top.every((c) => typeof c === "string")) {
    return invalidSetup("The setup's deckTop must be a list of card ids.");
  }
  const deck = new Set(setup.deck);
  const seen = new Set<CardId>();
  for (const card of top as CardId[]) {
    if (!deck.has(card)) return invalidSetup(`The setup's deckTop lists ${card}, which is not in the deck.`);
    if (seen.has(card)) return invalidSetup(`The setup's deckTop lists ${card} twice.`);
    seen.add(card);
  }
  return null;
}

/**
 * The draw pile: `deckTop` first, in its order, then the rest of the deck shuffled with `rng`. With no deckTop
 * this is exactly `shuffle(rng, setup.deck)`. deckTopError has checked the list.
 */
export function stackedDrawPile(rng: RngState, setup: Setup): { items: CardId[]; state: RngState } {
  const top = setup.deckTop ?? [];
  if (top.length === 0) return shuffle(rng, setup.deck);
  const listed = new Set(top);
  const rest = shuffle(
    rng,
    setup.deck.filter((card) => !listed.has(card)),
  );
  return { items: [...top, ...rest.items], state: rest.state };
}

const invalidSetup = (message: string): EngineError => ({ code: "invalidSetup", message });
