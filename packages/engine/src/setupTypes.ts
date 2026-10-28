// The setup's types: what createGame starts a game from. types.ts re-exports them, so index.ts exports the same names.
import type { DeckId } from "./contingencyTypes.ts";
import type { SetupMap } from "./mapTypes.ts";
import type { CardId, EraId, Side } from "./types.ts";

/**
 * An era after the first: its cards, in the setup's order, and the turn at whose start they are
 * shuffled into the draw pile (eras.ts).
 */
export type EraEntry = { era: EraId; turn: number; cards: CardId[] };

export type Setup = {
  seedHash: string;
  hands: Record<Side, CardId[]>;
  deck: CardId[];
  /** How many turns the game lasts: a whole number, 1 or more. */
  turns: number;
  /** How many plays each side makes per turn, after the opening cards: a whole number, 1 or more. */
  playsPerTurn: number;
  /**
   * How many cards each hand is refilled to at the start of each turn, from the draw pile: a whole number,
   * at least 1 + playsPerTurn. The first era (hands and deck) must hold at least twice as many cards that
   * stay in the game (none flagged removeAfterEvent; cardChecks.ts, handSizeError).
   */
  handSize: number;
  /**
   * The first era's name: required with a map, whose battleground lists are matched to eras by name
   * (battlegrounds.ts); ignored without one. No two eras share a name.
   */
  firstEra?: EraId;
  /** The eras after the first, each entering on its own turn, from 2 to the last. None when left out. */
  eras?: EraEntry[];
  /** Each side's Contingency deck and the World deck: whole numbers, 1 or more, at least 3 cards, any order. */
  contingency: Record<DeckId, number[]>;
  /** The map and each side's starting influence (mapChecks.ts). None when left out: the game has no map. */
  map?: SetupMap;
};
