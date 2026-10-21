// Card checks for createGame: the ruleset's cards are well formed, and a setup uses only known cards, each once.
import { badModifier } from "./modifiers.ts";
import { badTrigger } from "./triggers.ts";
import type { CardDef, CardId, Condition, EngineError, Ruleset, Setup, Side, Step } from "./types.ts";

/**
 * Why the ruleset's card list is unusable, or null: it must be a list, each `id` once, each `ops` a
 * whole number from 0, its `flags`, if any, well formed (badFlags), and no card's effect may hold a card choice (only a turn opens with one): a `choose`
 * in an effect asks yes/no only. The one other way an effect asks a side to pick cards is a discardFromHand
 * with `chosenBy`, and only to discard them.
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
    const flags = badFlags(card.flags);
    if (flags !== null) return invalidRuleset(`Card ${card.id}'s flags ${flags}`);
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
  // Across cards, so only once every card has passed the checks above and every walk meets well-formed steps.
  return unsetMarkerError(ruleset.cards);
}

/**
 * Why a card's `has` can never be true, or null: it names a label that no card in the ruleset (itself
 * included, at any depth, triggers too) sets with a lasting marker. A trigger's has filter counts as a has.
 */
function unsetMarkerError(cards: readonly CardDef[]): EngineError | null {
  const effects = cards.filter((card) => Array.isArray(card.effect));
  const lasting = new Set(effects.flatMap((card) => stepsIn(card.effect)).flatMap(lastingLabel));
  for (const card of effects) {
    const unset = stepsIn(card.effect)
      .flatMap(hasLabel)
      .find((label) => !lasting.has(label));
    if (unset !== undefined) {
      return invalidRuleset(
        `Card ${card.id}'s effect tests has "${unset}", but no card sets a lasting marker "${unset}".`,
      );
    }
  }
  return null;
}

/** Every step in `steps`, at any depth, each before the steps inside it. */
const stepsIn = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...stepsIn(innerSteps(step))]);
const lastingLabel = (step: Step): string[] => (step.op === "marker" && step.lasting === true ? [step.label] : []);
/** The label a step tests with `has`: an if's condition, or a trigger's filter. */
const hasLabel = (step: Step): string[] => {
  if (step.op === "if" && step.cond.op === "has") return [step.cond.marker];
  return step.op === "trigger" && step.filter?.op === "has" ? [step.filter.marker] : [];
};

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
    case "revealHand":
    case "discardFromHand":
      return [];
  }
}

/**
 * Why `step` itself (not the steps inside it) is malformed, or null: a number test's `value` and an
 * addToNumber's `amount` must be whole numbers, and an `amount` may not be 0. A modifier must use a hook,
 * side, add, min and duration the engine knows (badModifier); a trigger a hook and duration, and a
 * reaction of at least one step (badTrigger). A discardFromHand names LIO or SAE and a whole `count`, 1 or more,
 * and a `chosenBy`, if any, of "owner" or "player".
 */
function badStep(step: Step): string | null {
  switch (step.op) {
    case "addToNumber":
      return Number.isInteger(step.amount) && step.amount !== 0
        ? null
        : "adds an amount that is not a non-zero whole number.";
    case "if":
      return badCondition(step.cond);
    case "marker":
      if (step.lasting === undefined) return null;
      if (step.lasting !== true) return "has a marker whose lasting is not true (leave it out for a plain marker).";
      return typeof step.label === "string" && step.label.length > 0 ? null : "sets a lasting marker with no label.";
    case "modifier":
      return badModifier(step.mod, step.duration);
    case "trigger":
      return badTrigger(step);
    case "discardFromHand":
      if (step.side !== "lio" && step.side !== "sae")
        return 'discards from the hand of a side that is not "lio" or "sae".';
      if (!Number.isInteger(step.count) || step.count < 1)
        return "discards a number of cards that is not a whole number, 1 or more.";
      return step.chosenBy === undefined || step.chosenBy === "owner" || step.chosenBy === "player"
        ? null
        : 'has a discard chosen by someone other than "owner" or "player" (leave chosenBy out for a random discard).';
    default:
      return null;
  }
}

/**
 * Why an if's condition is malformed, or null: a number test's value is whole, a `has` names a label, a
 * `playedBy` names LIO or SAE. Values only: unknown keys are the card schema's job.
 */
function badCondition(cond: Condition): string | null {
  if (cond.op === "playedBy") {
    return cond.side === "lio" || cond.side === "sae" ? null : 'tests playedBy with a side that is not "lio" or "sae".';
  }
  if (cond.op === "has") {
    return typeof cond.marker === "string" && cond.marker.length > 0
      ? null
      : "tests has with a marker label that is empty or not text.";
  }
  return cond.op === "yes" || Number.isInteger(cond.value) ? null : "tests a number against a value that is not whole.";
}

/**
 * Why a card's `flags` are malformed, or null: left out, or an object whose one key so far, removeAfterEvent,
 * is true (left out otherwise). The same as the card schema refuses; card data may hold anything here.
 */
function badFlags(flags: unknown): string | null {
  if (flags === undefined) return null;
  if (typeof flags !== "object" || flags === null || Array.isArray(flags)) return "are not an object.";
  const unknown = Object.keys(flags).find((key) => key !== "removeAfterEvent");
  if (unknown !== undefined) return `hold ${unknown}, a flag the engine doesn't have.`;
  const { removeAfterEvent } = flags as { removeAfterEvent?: unknown };
  return removeAfterEvent === undefined || removeAfterEvent === true
    ? null
    : "set removeAfterEvent to something other than true (leave it out for a card that stays).";
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
 * Why the hand size does not fit the setup, or null (docs/design/core-loop.md, "Refilling hands"). Each
 * turn a side needs one opening card and `playsPerTurn` plays, so the hand size is at least 1 + playsPerTurn.
 * And the first era (both hands and the draw pile) needs at least twice the hand size in cards that stay in
 * the game: then both hands fill on turn 1, and every refill after that can draw, because at a turn's start
 * every card still in the game is in a hand, the draw pile or the discard pile, and later eras only add cards.
 * A card flagged removeAfterEvent is left out of the count: it may leave the game, for `removed`, once its
 * event happens, and in the worst case every one of them has. Scenarios deal no hands; tests may, and a refill
 * only tops up.
 */
export function handSizeError(ruleset: Ruleset, setup: Setup): EngineError | null {
  const { handSize, playsPerTurn } = setup;
  if (handSize < 1 + playsPerTurn) {
    return invalidSetup(
      `The hand size is ${handSize}; an opening card and ${playsPerTurn} plays need ${1 + playsPerTurn}.`,
    );
  }
  const leaving = new Set(ruleset.cards.filter((card) => card.flags?.removeAfterEvent === true).map((c) => c.id));
  const staying = [...setup.hands.lio, ...setup.hands.sae, ...setup.deck].filter((id) => !leaving.has(id)).length;
  if (staying < 2 * handSize) {
    return invalidSetup(
      `The first era has ${staying} cards that stay in the game; two hands of ${handSize} need at least ${2 * handSize}.`,
    );
  }
  return null;
}
