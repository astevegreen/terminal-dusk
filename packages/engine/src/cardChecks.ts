// Card checks for createGame: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { badModifier } from "./modifiers.ts";
import { badTrigger } from "./triggers.ts";
import { SIDES } from "./types.ts";
import type { CardId, EngineError, Ruleset, Setup, Side, Step } from "./types.ts";

/**
 * Why the ruleset's card list is unusable, or null: it must be a list, each `id` once, each `ops` a
 * whole number from 0, and no card's effect may hold a card choice (only a turn opens with one).
 */
export function rulesetError(ruleset: Ruleset): EngineError | null {
  if (!Array.isArray(ruleset?.cards)) return invalidRuleset("The ruleset needs a list of cards.");
  if (typeof ruleset.id !== "string" || ruleset.id.length === 0) return invalidRuleset("The ruleset needs an id.");
  const seen = new Set<CardId>();
  for (const card of ruleset.cards) {
    if (seen.has(card?.id)) return invalidRuleset(`Two cards share the id ${card.id}.`);
    seen.add(card?.id);
    if (!Number.isInteger(card?.ops) || card.ops < 0) {
      return invalidRuleset(`Card ${card?.id}'s ops must be a whole number, 0 or more.`);
    }
    if (Array.isArray(card.effect)) {
      // Malformed steps first, so the walks below only ever meet lists of steps where steps hold them.
      const badStep = findBadStep(card.effect);
      if (badStep !== null) return invalidRuleset(`Card ${card.id}'s effect ${badStep}`);
      if (holdsCardChoice(card.effect)) {
        return invalidRuleset(`Card ${card.id}'s effect asks both sides to pick a card; only a turn's opening does.`);
      }
      const misplaced = findMisplacedDraw(card.effect, card.affiliation);
      if (misplaced !== null) return invalidRuleset(misplacedDrawMessage(card.id, card.affiliation, misplaced));
    }
  }
  return null;
}

const SIDE_NAMES = { lio: "LIO", sae: "SAE" } as const;

/** The plain-English reason a card may not draw from `drawn`, a deck it may not name. */
function misplacedDrawMessage(id: CardId, affiliation: Side | "neutral", drawn: Side | "player"): string {
  if (affiliation === "neutral") {
    return `Card ${id} is a neutral card, but its event draws from ${SIDE_NAMES[drawn as Side]}'s Contingency deck; a neutral event draws from the deck of the side that played it ("side": "player").`;
  }
  return `Card ${id} is an ${SIDE_NAMES[affiliation]} card, but its event draws from the deck of the side that played it; only a neutral event does, and an ${SIDE_NAMES[affiliation]} event names LIO's or SAE's deck.`;
}

/**
 * The deck named by the first `drawContingency` in `steps` (at any depth) that this card may not draw
 * from, or null. An LIO or SAE card may draw from either deck, the rival's included, and from both (owner
 * 19 Oct); a neutral card only from the deck of the side that played it, "player" (decision 17). Both are
 * in docs/design/contingency-deck.md.
 */
const findMisplacedDraw = (steps: readonly Step[], affiliation: Side | "neutral"): Side | "player" | null => {
  for (const step of steps) {
    if (step.op === "drawContingency" && (step.side === "player") !== (affiliation === "neutral")) return step.side;
    const found = findMisplacedDraw(innerSteps(step), affiliation);
    if (found !== null) return found;
  }
  return null;
};

/** The steps held inside `step`: an if's two branches, a forEach's or a trigger's `do`; none for the rest. */
function innerSteps(step: Step): readonly Step[] {
  switch (step.op) {
    case "if":
      return [...step.then, ...(step.else ?? [])];
    case "forEach":
    case "trigger":
      return step.do;
    case "choose":
    case "marker":
    case "spendPoints":
    case "drawContingency":
    case "addToNumber":
    case "modifier":
      return [];
  }
}

/**
 * Why `step` itself (not the steps inside it) is malformed, or null: a number test's `value` and an
 * addToNumber's `amount` must be whole numbers, and an `amount` may not be 0. A modifier must use a hook,
 * side, add, min and duration the engine knows (badModifier); a trigger a hook and duration, and a
 * reaction of at least one step (badTrigger).
 */
function badStep(step: Step): string | null {
  switch (step.op) {
    case "addToNumber":
      return Number.isInteger(step.amount) && step.amount !== 0
        ? null
        : "adds an amount that is not a non-zero whole number.";
    case "if":
      return step.cond.op === "yes" || Number.isInteger(step.cond.value)
        ? null
        : "tests a number against a value that is not whole.";
    case "modifier":
      return badModifier(step.mod, step.duration);
    case "trigger":
      return badTrigger(step);
    default:
      return null;
  }
}

/** Why the first malformed step in `steps`, at any depth, is malformed (badStep), or null. */
const findBadStep = (steps: readonly Step[]): string | null => {
  for (const step of steps) {
    const found = badStep(step) ?? findBadStep(innerSteps(step));
    if (found !== null) return found;
  }
  return null;
};

/** True if `steps`, or any block inside them, holds a choice of a card. */
const holdsCardChoice = (steps: readonly Step[]): boolean =>
  steps.some((step) =>
    step.op === "choose" ? step.decision.kind === "chooseCard" : holdsCardChoice(innerSteps(step)),
  );

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
