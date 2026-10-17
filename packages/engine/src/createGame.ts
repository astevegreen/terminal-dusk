import { seedRng } from "./rng.ts";
import type { GameEvent, GameState, Result, Ruleset, Seed, Setup } from "./types.ts";

/** Builds a starting game. Bad input returns an error; it never throws. */
export function createGame(
  ruleset: Ruleset,
  setup: Setup,
  seed: Seed,
): Result<{ state: GameState; events: GameEvent[] }> {
  if (typeof seed !== "string" || seed.length === 0) {
    return { ok: false, error: { code: "invalidSeed", message: "The seed must not be empty." } };
  }
  if (typeof setup?.seedHash !== "string" || setup.seedHash.length === 0) {
    return { ok: false, error: { code: "invalidSetup", message: "The setup needs a seedHash." } };
  }
  const lists = [setup.hands?.lio, setup.hands?.sae, setup.deck];
  if (!lists.every((l) => Array.isArray(l))) {
    return {
      ok: false,
      error: { code: "invalidSetup", message: "The setup needs hands for both sides and a deck." },
    };
  }
  const state: GameState = {
    public: { turn: 1, discard: [] },
    private: {
      lio: { hand: [...setup.hands.lio] },
      sae: { hand: [...setup.hands.sae] },
    },
    secret: { rng: seedRng(seed), deck: [...setup.deck] },
    meta: { ruleset: ruleset.id, seedHash: setup.seedHash, seq: 0 },
  };
  return { ok: true, value: { state, events: [] } };
}
