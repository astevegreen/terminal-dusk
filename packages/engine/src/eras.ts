// Eras after the first (docs/design/eras.md, "When a new era starts"). Each waits in the secret
// compartment until the start of its turn, then its cards are shuffled into the draw pile only: the
// discard pile stays where it is. Which cards, and on which turn, is setup data.
import { shuffle } from "./rng.ts";
import type { EngineError, GameEvent, GameState, Setup } from "./types.ts";

/**
 * Why the setup's eras are unusable, or null. Each needs a name, a list of at least one card, and a
 * whole-number turn from 2 to the last turn, no two on the same turn. setupCardsError checks the
 * cards themselves: each in the ruleset, and none used twice anywhere in the setup.
 */
export function erasError(setup: Setup): EngineError | null {
  if (setup.eras === undefined) return null;
  if (!Array.isArray(setup.eras)) return invalidSetup("The setup's eras must be a list.");
  const turns = new Set<number>();
  for (const entry of setup.eras) {
    if (typeof entry?.era !== "string" || entry.era.length === 0) return invalidSetup("Each era needs a name.");
    if (!Array.isArray(entry.cards) || entry.cards.length === 0) {
      return invalidSetup(`Era ${entry.era} needs at least one card.`);
    }
    if (!Number.isInteger(entry.turn) || entry.turn < 2 || entry.turn > setup.turns) {
      return invalidSetup(`Era ${entry.era} must enter on a whole-number turn from 2 to ${setup.turns}.`);
    }
    if (turns.has(entry.turn)) return invalidSetup(`Two eras enter on turn ${entry.turn}.`);
    turns.add(entry.turn);
  }
  return null;
}

/**
 * Runs at the start of a turn, before its opening picks. If an era enters on this turn, its cards
 * leave the secret compartment and the draw pile becomes a shuffle, with the game's generator, of
 * the draw pile followed by the era's cards in the setup's order. Edits `state` in place.
 */
export function enterEra(state: GameState, events: GameEvent[]): void {
  const entering = state.secret.eras.find((entry) => entry.turn === state.public.turn);
  if (entering === undefined) return;
  const shuffled = shuffle(state.secret.rng, [...state.secret.deck, ...entering.cards]);
  state.secret.rng = shuffled.state;
  state.secret.deck = shuffled.items;
  state.secret.eras = state.secret.eras.filter((entry) => entry !== entering);
  events.push({ kind: "eraStarted", visibility: "public", era: entering.era, cardsAdded: entering.cards.length });
}

const invalidSetup = (message: string): EngineError => ({ code: "invalidSetup", message });
