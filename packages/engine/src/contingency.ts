// Contingency decks (docs/design/contingency-deck.md): each side's numbered cards, drawn instead of rolling
// a die. Which numbers are left is public; the order is secret. The setup gives the cards; nothing is hard-coded.
import { shuffle } from "./rng.ts";
import type { RngState } from "./rng.ts";
import { SIDES } from "./types.ts";
import type { ContingencyDeck, EngineError, GameEvent, GameState, Setup, Side } from "./types.ts";

/** Numbers sorted ascending, as numbers (plain `.sort()` would put 10 before 2). Returns a new list. */
const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

const isCard = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1;

/** The fewest cards a deck may hold, so every draw is from at least this many (contingency-deck.md, "The deck"). */
const MIN_DECK = 3;
/** A draw that leaves this many cards rebuilds the deck straight away (contingency-deck.md, "Reshuffle"). */
const RESHUFFLE_AT = 2;

/** Why the setup's Contingency decks are unusable, or null. Each side needs at least 3 whole numbers, 1 or more. */
export function contingencyError(setup: Setup): EngineError | null {
  const decks: unknown = setup.contingency;
  if (typeof decks !== "object" || decks === null || Array.isArray(decks)) {
    return { code: "invalidSetup", message: "The setup needs a Contingency deck for each side." };
  }
  for (const side of SIDES) {
    const deck: unknown = (decks as Record<string, unknown>)[side];
    if (!Array.isArray(deck) || deck.length < MIN_DECK || !deck.every(isCard)) {
      return {
        code: "invalidSetup",
        message: `The ${side} Contingency deck must be a list of at least ${MIN_DECK} whole numbers, each 1 or more.`,
      };
    }
  }
  return null;
}

/**
 * Shuffles each side's deck, in SIDES order, continuing from `rng`. Each deck is sorted first, so its
 * order depends only on its cards and the generator, never on how the setup listed them.
 */
export function shuffleContingency(
  rng: RngState,
  setup: Setup,
): { rng: RngState; open: Record<Side, ContingencyDeck>; order: Record<Side, number[]> } {
  let current = rng;
  const deal = (side: Side) => {
    const cards = ascending(setup.contingency[side]);
    const shuffled = shuffle(current, cards);
    current = shuffled.state;
    return { open: { cards, left: [...cards] }, order: shuffled.items };
  };
  const lio = deal("lio");
  const sae = deal("sae");
  return { rng: current, open: { lio: lio.open, sae: sae.open }, order: { lio: lio.order, sae: sae.order } };
}

/**
 * Draws a contingency for `side` and returns its number: the top card of that side's secret order comes
 * off, and one instance of its number leaves the numbers left (a deck may repeat a number). If that
 * leaves two cards, the deck is rebuilt straight away as a shuffle, with the game's generator, of its full
 * contents sorted ascending. Edits `state`, apply's working copy, in place, like enterEra.
 */
export function drawContingency(state: GameState, side: Side, events: GameEvent[]): number {
  const open = state.public.contingency[side];
  // A deck always holds 3 or more cards: createGame checks the setup, and a reshuffle refills it.
  const [top, ...rest] = state.secret.contingency[side] as [number, ...number[]];
  state.secret.contingency[side] = rest;
  open.left.splice(open.left.indexOf(top), 1);
  events.push({ kind: "contingencyDrawn", visibility: "public", side, value: top });
  if (rest.length === RESHUFFLE_AT) {
    const shuffled = shuffle(state.secret.rng, ascending(open.cards));
    state.secret.rng = shuffled.state;
    state.secret.contingency[side] = shuffled.items;
    open.left = ascending(open.cards);
    events.push({ kind: "contingencyDeckReshuffled", visibility: "public", side });
  }
  return top;
}
