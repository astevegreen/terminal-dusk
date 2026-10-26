// Test helpers for spending points on the test map (R16a placing, R16b intervening): a game at LIO's first play,
// with the influence a test needs, and what one side has in one country.
import type { CountryId, GameState, Side, Step } from "../types.ts";
import { playAnswers, ruleset, startGame } from "./game.ts";
import { mapSetup } from "./map.ts";

/** A spendPoints step: `side` spends `amount` points. */
export const spend = (side: Side, amount: number): Step => ({ op: "spendPoints", side, amount });

/** A map game at LIO's first play, with influence set from `counts` (0 where none is given), or the map's start. */
export function mapGame(counts?: Record<CountryId, { lio?: number; sae?: number }>): GameState {
  const state = playAnswers(startGame(2, 1, ruleset, mapSetup()), 2);
  if (counts === undefined) return state;
  const influence = state.public.influence!.map(({ country }) => ({
    country,
    lio: counts[country]?.lio ?? 0,
    sae: counts[country]?.sae ?? 0,
  }));
  return { ...state, public: { ...state.public, influence } };
}

/** `side`'s influence in `country`. */
export const countOf = (state: GameState, country: CountryId, side: Side): number =>
  state.public.influence!.find((e) => e.country === country)![side];
