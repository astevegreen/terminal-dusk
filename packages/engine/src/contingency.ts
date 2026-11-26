// Contingency decks (docs/design/contingency-deck.md): each side's numbered cards and the shared World deck,
// drawn instead of rolling a die. Which numbers are left is public; the order is secret. The setup gives the
// cards; nothing is hard-coded.
import { takeRedraw } from "./abilities.ts";
import { shuffle } from "./rng.ts";
import type { RngState } from "./rng.ts";
import { DECKS } from "./types.ts";
import type { ContingencyDeck, DeckId, EngineError, GameEvent, GameState, Setup, Side } from "./types.ts";

/** Numbers sorted ascending, as numbers (plain `.sort()` would put 10 before 2). Returns a new list. */
const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

const isCard = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1;

/** The fewest cards a deck may hold, so every draw is from at least this many (contingency-deck.md, "The deck"). */
const MIN_DECK = 3;
/** A draw that leaves this many cards rebuilds the deck straight away (contingency-deck.md, "Reshuffle"). */
const RESHUFFLE_AT = 2;

/**
 * Why the setup's Contingency decks are unusable, or null. Each side's deck and the World deck need at least
 * 3 whole numbers, 1 or more.
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
 * Shuffles each deck in DECKS order (LIO's, SAE's, then the World deck), continuing from `rng`. Each deck is
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
 * The deck a `drawContingency` step draws from. `named` is the deck the step names ("player": the side that
 * played the card). `program` is the running program: its `player`, and its `worldFor` when its card is the
 * rival's (the card's owner). A rival's card's draws from its owner's deck come from the World deck; every
 * other draw, the ones it sends to the player's own deck included, uses the deck named
 * (contingency-deck.md, "The World deck"). Undefined when a "player" draw has no player.
 */
export function deckFor(
  named: Side | "player",
  program: { player?: Side; worldFor?: Side } | undefined,
): DeckId | undefined {
  const side = named === "player" ? program?.player : named;
  return side !== undefined && side === program?.worldFor ? "world" : side;
}

/**
 * Draws a contingency from `deck` and returns its number: the top card of that deck's secret order comes
 * off, and one instance of its number leaves the numbers left (a deck may repeat a number). If that
 * leaves two cards, the deck is rebuilt straight away as a shuffle, with the game's generator, of its full
 * contents sorted ascending. Edits `state`, apply's working copy, in place, like enterEra. No ability applies: the
 * crisis draw uses this (escalation.ts).
 */
export function drawPlain(state: GameState, deck: DeckId, events: GameEvent[]): number {
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

/**
 * The side whose draw bonuses apply to a `drawContingency` step (contingency-deck.md, "Whose bonuses apply").
 * The World deck has no owner, so no side's apply to it. In a card's event (the program has a `player`), only the
 * player's apply, and only to a draw from the player's own deck; the other side's never do (owner, 26 Nov 2026:
 * "No redraw"), and only when the draw is made for the player: a draw `madeFor` the rival, settling the rival's
 * result or choice (a neutral card's), gets none (owner, 26 Nov 2026: "No redraw"). With no player it is no card's
 * event, and the deck's owner's bonuses apply, as for any draw outside card events. Undefined when no side's apply.
 */
export function bonusSide(
  named: Side | "player",
  program: { player?: Side; worldFor?: Side } | undefined,
  madeFor?: Side,
): Side | undefined {
  const deck = deckFor(named, program);
  const player = program?.player;
  if (deck === undefined || deck === "world") return undefined;
  if (player === undefined) return deck;
  return deck === player && (madeFor === undefined || madeFor === player) ? deck : undefined;
}

/**
 * Draws a contingency from `deck` as drawPlain does, except that a 1, while `side`'s Resilient institutions has a
 * use left this turn, is set aside (it stays drawn) and the draw is made again. `side` is the side whose bonuses
 * apply (none: no one's); a card's step passes bonusSide's. The second draw stands even if it is a 1 (#602);
 * perTurn counts such draws in a turn, never redraws within one.
 */
export function drawWithBonus(state: GameState, deck: DeckId, side: Side | undefined, events: GameEvent[]): number {
  const value = drawPlain(state, deck, events);
  return takeRedraw(state, side, deck, value, events) ? drawPlain(state, deck, events) : value;
}

/**
 * A draw outside card events (interventions, realignments, the tech race): drawWithBonus with the bonuses of the
 * deck's owner, so Resilient institutions works only on its own side's deck (the World deck has no owner).
 */
export function drawContingency(state: GameState, deck: DeckId, events: GameEvent[]): number {
  return drawWithBonus(state, deck, deck === "world" ? undefined : deck, events);
}
