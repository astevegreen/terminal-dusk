import { handSizeError, rulesetError, setupCardsError } from "./cardChecks.ts";
import { contingencyError, shuffleContingency } from "./contingency.ts";
import { erasError } from "./eras.ts";
import { seedRng, shuffle } from "./rng.ts";
import { seedHash } from "./sha256.ts";
import { newBudget } from "./stack.ts";
import { startTurn } from "./turn.ts";
import type { EraEntry, GameEvent, GameState, Result, Ruleset, Seed, Setup } from "./types.ts";

/** Builds a starting game, open at the first turn's opening pick. Bad input returns an error; it never throws. */
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
  if (setup.seedHash !== seedHash(seed)) {
    return { ok: false, error: { code: "seedMismatch", message: "The setup's seedHash is not the hash of the seed." } };
  }
  const lists = [setup.hands?.lio, setup.hands?.sae, setup.deck];
  if (!lists.every((l) => Array.isArray(l))) {
    return {
      ok: false,
      error: { code: "invalidSetup", message: "The setup needs hands for both sides and a deck." },
    };
  }
  for (const [name, value] of [
    ["turns", setup.turns],
    ["playsPerTurn", setup.playsPerTurn],
    ["handSize", setup.handSize],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      return {
        ok: false,
        error: { code: "invalidSetup", message: `The setup's ${name} must be a whole number, 1 or more.` },
      };
    }
  }
  const badDecks = contingencyError(setup);
  if (badDecks) return { ok: false, error: badDecks };
  const badCards = erasError(setup) ?? setupCardsError(ruleset, setup) ?? handSizeError(setup);
  if (badCards) return { ok: false, error: badCards };
  // The hands keep the setup's order; the turn 1 refill fills them from the draw pile. One generator shuffles the
  // draw pile, then LIO's Contingency deck, then SAE's; this order never changes, so a seed always gives the same game.
  const drawPile = shuffle(seedRng(seed), setup.deck);
  const decks = shuffleContingency(drawPile.state, setup);
  const state: GameState = {
    public: {
      turn: 1,
      turns: setup.turns,
      playsPerTurn: setup.playsPerTurn,
      handSize: setup.handSize,
      playsMade: 0,
      inPlay: [],
      inPlayBy: [],
      discard: [],
      pending: [],
      stack: [],
      status: { kind: "active" },
      contingency: decks.open,
      modifiers: [],
      triggers: [],
      turnEndFired: false,
      markers: [],
    },
    private: {
      lio: { hand: [...setup.hands.lio], picks: [] },
      sae: { hand: [...setup.hands.sae], picks: [] },
    },
    secret: {
      rng: decks.rng,
      deck: drawPile.items,
      eras: (setup.eras ?? []).map(copyEra),
      contingency: decks.order,
    },
    meta: { ruleset: ruleset.id, seedHash: setup.seedHash, seq: 0 },
  };
  // The first turn opens through the stack, so the step budget covers createGame too.
  const events: GameEvent[] = [];
  const error = startTurn(state, events, newBudget(ruleset));
  return error ? { ok: false, error } : { ok: true, value: { state, events } };
}

/** A copy of an era entry, so the state shares nothing with the setup. */
const copyEra = ({ era, turn, cards }: EraEntry): EraEntry => ({ era, turn, cards: [...cards] });
