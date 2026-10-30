// Contingency decks (docs/design/contingency-deck.md): each side's numbered cards and the shared World deck,
// drawn instead of rolling a die. Which numbers are left is public; the order is secret. The setup gives the
// cards; nothing is hard-coded.
import { shuffle } from "./rng.ts";
import type { RngState } from "./rng.ts";
import { DECKS } from "./types.ts";
import type { CardDef, ContingencyDeck, DeckId, EngineError, GameEvent, GameState, Setup, Side } from "./types.ts";

/** Numbers sorted ascending, as numbers (plain `.sort()` would put 10 before 2). Returns a new list. */
const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

const isCard = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1;

/** The fewest cards a deck may hold, so every draw is from at least this many (contingency-deck.md, "The deck"). */
const MIN_DECK = 3;
/** A draw that leaves this many cards rebuilds the deck straight away (contingency-deck.md, "Reshuffle"). */
const RESHUFFLE_AT = 2;

/**
 * Why the setup's Contingency decks are unusable, or null. Each deck, LIO's, SAE's and the World deck, needs at
 * least 3 whole numbers, 1 or more.
 */
export function contingencyError(setup: Setup): EngineError | null {
  const decks: unknown = setup.contingency;
  if (typeof decks !== "object" || decks === null || Array.isArray(decks)) {
    return { code: "invalidSetup", message: "The setup needs a Contingency deck for each side and the World deck." };
  }
  for (const id of DECKS) {
    const deck: unknown = (decks as Record<string, unknown>)[id];
    if (!Array.isArray(deck) || deck.length < MIN_DECK || !deck.every(isCard)) {
      return {
        code: "invalidSetup",
        message: `The ${id} Contingency deck must be a list of at least ${MIN_DECK} whole numbers, each 1 or more.`,
      };
    }
  }
  return null;
}

/**
 * Shuffles each deck, in DECKS order (LIO's, SAE's, then the World deck), continuing from `rng`. Each deck is
 * sorted first, so its order depends only on its cards and the generator, never on how the setup listed them.
 */
export function shuffleContingency(
  rng: RngState,
  setup: Setup,
): { rng: RngState; open: Record<DeckId, ContingencyDeck>; order: Record<DeckId, number[]> } {
  let current = rng;
  const deal = (id: DeckId) => {
    const cards = ascending(setup.contingency[id]);
    const shuffled = shuffle(current, cards);
    current = shuffled.state;
    return { open: { cards, left: [...cards] }, order: shuffled.items };
  };
  const lio = deal("lio");
  const sae = deal("sae");
  const world = deal("world");
  return {
    rng: current,
    open: { lio: lio.open, sae: sae.open, world: world.open },
    order: { lio: lio.order, sae: sae.order, world: world.order },
  };
}

/**
 * The side whose own-deck draws come from the World deck while `card`'s event runs: the card's owner, when
 * `player`, the side that picked or played it, is the rival. Undefined for a side's own card, a neutral card,
 * or a program no side played (contingency-deck.md, "The World deck").
 */
export function worldFor(card: CardDef | undefined, player: Side | undefined): Side | undefined {
  const owner = card?.affiliation;
  return owner === undefined || owner === "neutral" || player === undefined || owner === player ? undefined : owner;
}

/** The deck a draw naming `named`'s deck takes from: the World deck when `named` is the program's `worldFor`. */
export const deckFor = (named: Side, world: Side | undefined): DeckId => (named === world ? "world" : named);

/**
 * Draws a contingency from `deck` and returns its number: the top card of that deck's secret order comes
 * off, and one instance of its number leaves the numbers left (a deck may repeat a number). If that
 * leaves two cards, the deck is rebuilt straight away as a shuffle, with the game's generator, of its full
 * contents sorted ascending. Edits `state`, apply's working copy, in place, like enterEra.
 */
export function drawContingency(state: GameState, deck: DeckId, events: GameEvent[]): number {
  const open = state.public.contingency[deck];
  // A deck always holds 3 or more cards: createGame checks the setup, and a reshuffle refills it.
  const [top, ...rest] = state.secret.contingency[deck] as [number, ...number[]];
  state.secret.contingency[deck] = rest;
  open.left.splice(open.left.indexOf(top), 1);
  events.push({ kind: "contingencyDrawn", visibility: "public", deck, value: top });
  if (rest.length === RESHUFFLE_AT) {
    const shuffled = shuffle(state.secret.rng, ascending(open.cards));
    state.secret.rng = shuffled.state;
    state.secret.contingency[deck] = shuffled.items;
    open.left = ascending(open.cards);
    events.push({ kind: "contingencyDeckReshuffled", visibility: "public", deck });
  }
  return top;
}
