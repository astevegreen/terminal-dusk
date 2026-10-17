import { rulesetError, setupCardsError } from "./cardChecks.ts";
import { seedRng, shuffle } from "./rng.ts";
import { newGroup } from "./decisions.ts";
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
  const badRuleset = rulesetError(ruleset);
  if (badRuleset) return { ok: false, error: badRuleset };
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
  if (!Number.isInteger(setup.rounds) || setup.rounds < 1) {
    return {
      ok: false,
      error: { code: "invalidSetup", message: "The setup needs rounds of at least 1." },
    };
  }
  const badCards = setupCardsError(ruleset, setup);
  if (badCards) return { ok: false, error: badCards };
  // The hands keep the setup's order; the draw pile is shuffled with the game's own generator.
  const drawPile = shuffle(seedRng(seed), setup.deck);
  const state: GameState = {
    public: {
      turn: 1,
      rounds: setup.rounds,
      discard: [],
      pending: newGroup(0, "yesNo"),
      stack: [],
      status: { kind: "active" },
    },
    private: {
      lio: { hand: [...setup.hands.lio], picks: [] },
      sae: { hand: [...setup.hands.sae], picks: [] },
    },
    secret: { rng: drawPile.state, deck: drawPile.items },
    meta: { ruleset: ruleset.id, seedHash: setup.seedHash, seq: 0 },
  };
  return { ok: true, value: { state, events: [] } };
}
