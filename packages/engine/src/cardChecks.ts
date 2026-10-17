// Card checks for createGame: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { SIDES } from "./types.ts";
import type { CardId, EngineError, Ruleset, Setup, Step } from "./types.ts";

/**
 * Why the ruleset's card list is unusable, or null: it must be a list, each `id` once, each `ops` a
 * whole number from 0, and no card's effect may hold a card choice (only a turn opens with one).
 */
export function rulesetError(ruleset: Ruleset): EngineError | null {
  if (!Array.isArray(ruleset?.cards)) return invalidRuleset("The ruleset needs a list of cards.");
  const seen = new Set<CardId>();
  for (const card of ruleset.cards) {
    if (seen.has(card?.id)) return invalidRuleset(`Two cards share the id ${card.id}.`);
    seen.add(card?.id);
    if (!Number.isInteger(card?.ops) || card.ops < 0) {
      return invalidRuleset(`Card ${card?.id}'s ops must be a whole number, 0 or more.`);
    }
    if (Array.isArray(card.effect) && holdsCardChoice(card.effect)) {
      return invalidRuleset(`Card ${card.id}'s effect asks both sides to pick a card; only a turn's opening does.`);
    }
  }
  return null;
}

/** True if `steps`, or any block inside them, holds a choice of a card. */
const holdsCardChoice = (steps: readonly Step[]): boolean =>
  steps.some((step) => {
    switch (step.op) {
      case "choose":
        return step.decision.kind === "chooseCard";
      case "if":
        return holdsCardChoice(step.then) || holdsCardChoice(step.else ?? []);
      case "forEach":
        return holdsCardChoice(step.do);
      case "marker":
      case "spendPoints":
      case "drawContingency":
        return false;
    }
  });

/**
 * Why the setup's cards are wrong, or null: every card in the hands, the draw pile and the later eras
 * is in the ruleset, and none twice, within one list or across them. A card listed under a later era
 * must be from that era (its `era` matches the entry's). Run after erasError.
 */
export function setupCardsError(ruleset: Ruleset, setup: Setup): EngineError | null {
  const eraOfCard = new Map(ruleset.cards.map((card) => [card.id, card.era]));
  const used = new Set<CardId>();
  const places: [string, readonly CardId[], string?][] = [
    ["LIO's hand", setup.hands.lio],
    ["SAE's hand", setup.hands.sae],
    ["the draw pile", setup.deck],
    ...(setup.eras ?? []).map((entry): [string, readonly CardId[], string?] => [
      `era ${entry.era}`,
      entry.cards,
      entry.era,
    ]),
  ];
  for (const [place, cards, era] of places) {
    for (const card of cards) {
      if (!eraOfCard.has(card)) return invalidSetup(`${place} holds ${card}, which the ruleset doesn't have.`);
      if (era !== undefined && eraOfCard.get(card) !== era) {
        return invalidSetup(`${place} holds ${card}, which belongs to era ${eraOfCard.get(card)}, not ${era}.`);
      }
      if (used.has(card)) return invalidSetup(`${card} is in the setup twice (again in ${place}).`);
      used.add(card);
    }
  }
  return null;
}

const invalidRuleset = (message: string): EngineError => ({ code: "invalidRuleset", message });
const invalidSetup = (message: string): EngineError => ({ code: "invalidSetup", message });

/**
 * TEMPORARY until hands are refilled: why a side's hand is too small for the whole game, or null. Each
 * turn takes one non-neutral opening card and `playsPerTurn` plays from each side, so each side needs
 * at least turns x (1 + playsPerTurn) non-neutral cards. Neutral cards don't count: they can't open.
 */
export function handSizeError(ruleset: Ruleset, setup: Setup): EngineError | null {
  const neutral = new Set(ruleset.cards.filter((card) => card.affiliation === "neutral").map((card) => card.id));
  const needed = setup.turns * (1 + setup.playsPerTurn);
  for (const side of SIDES) {
    const have = setup.hands[side].filter((card) => !neutral.has(card)).length;
    if (have < needed) {
      const who = side === "lio" ? "LIO" : "SAE";
      return invalidSetup(
        `${who}'s hand has ${have} non-neutral cards; ${setup.turns} turns of an opening card and ` +
          `${setup.playsPerTurn} plays need ${needed}.`,
      );
    }
  }
  return null;
}
