// Card checks for createGame: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import type { CardId, EngineError, Ruleset, Setup } from "./types.ts";

/** Why the ruleset's card list is unusable, or null: it must be a list, each `id` once, each `ops` a whole number from 0. */
export function rulesetError(ruleset: Ruleset): EngineError | null {
  if (!Array.isArray(ruleset?.cards)) return invalidRuleset("The ruleset needs a list of cards.");
  const seen = new Set<CardId>();
  for (const card of ruleset.cards) {
    if (seen.has(card?.id)) return invalidRuleset(`Two cards share the id ${card.id}.`);
    seen.add(card?.id);
    if (!Number.isInteger(card?.ops) || card.ops < 0) {
      return invalidRuleset(`Card ${card?.id}'s ops must be a whole number, 0 or more.`);
    }
  }
  return null;
}

/** Why the setup's cards are wrong, or null: every card in the hands and draw pile is in the ruleset, and none twice. */
export function setupCardsError(ruleset: Ruleset, setup: Setup): EngineError | null {
  const known = new Set(ruleset.cards.map((card) => card.id));
  const used = new Set<CardId>();
  const places: [string, readonly CardId[]][] = [
    ["LIO's hand", setup.hands.lio],
    ["SAE's hand", setup.hands.sae],
    ["the draw pile", setup.deck],
  ];
  for (const [place, cards] of places) {
    for (const card of cards) {
      if (!known.has(card)) return invalidSetup(`${place} holds ${card}, which the ruleset doesn't have.`);
      if (used.has(card)) return invalidSetup(`${card} is in the setup twice (again in ${place}).`);
      used.add(card);
    }
  }
  return null;
}

const invalidRuleset = (message: string): EngineError => ({ code: "invalidRuleset", message });
const invalidSetup = (message: string): EngineError => ({ code: "invalidSetup", message });
