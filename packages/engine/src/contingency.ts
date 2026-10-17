// Contingency decks (docs/design/contingency-deck.md): each side's numbered cards, drawn instead of rolling
// a die. Which numbers are left is public; the order is secret. The setup gives the cards; nothing is hard-coded.
import { shuffle } from "./rng.ts";
import type { RngState } from "./rng.ts";
import { SIDES } from "./types.ts";
import type { ContingencyDeck, EngineError, Setup, Side } from "./types.ts";

/** Numbers sorted ascending, as numbers (plain `.sort()` would put 10 before 2). Returns a new list. */
const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

const isCard = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1;

/** Why the setup's Contingency decks are unusable, or null. Each side needs at least 2 whole numbers, 1 or more. */
export function contingencyError(setup: Setup): EngineError | null {
  const decks: unknown = setup.contingency;
  if (typeof decks !== "object" || decks === null || Array.isArray(decks)) {
    return { code: "invalidSetup", message: "The setup needs a Contingency deck for each side." };
  }
  for (const side of SIDES) {
    const deck: unknown = (decks as Record<string, unknown>)[side];
    if (!Array.isArray(deck) || deck.length < 2 || !deck.every(isCard)) {
      return {
        code: "invalidSetup",
        message: `The ${side} Contingency deck must be a list of at least 2 whole numbers, each 1 or more.`,
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
