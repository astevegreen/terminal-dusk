// How each EventKind is presented. A new kind without an entry here fails the type check (hard rule 9).
import { SIDES } from "@terminal-dusk/engine";
import type { DeckId, EventKind, GameEvent, HookId, ModifierSpec, VarValue } from "@terminal-dusk/engine";
import { SIDE_NAME } from "./displayText.ts";
import type { GameNames } from "./displayText.ts";

/** One game-log line per event, naming cards and eras by `names` and sides as LIO and SAE. */
export type EventPresentation = {
  [K in EventKind]: { log: (event: Extract<GameEvent, { kind: K }>, names: GameNames) => string };
};

/** When a trigger's hook happens, in words. */
const HOOK_TEXT: Record<HookId, string> = {
  cardPlayed: "whenever a card is played this turn",
  turnEnd: "at the end of this turn",
};

/** A marker's value as text: both sides' answers read "LIO yes, SAE no", in SIDES order. */
const shown = (value: VarValue): string =>
  typeof value === "object"
    ? SIDES.map((side) => `${SIDE_NAME[side]} ${value[side] ? "yes" : "no"}`).join(", ")
    : String(value);

/** A Contingency deck in words: "the LIO Contingency deck", or "the World deck". */
const deckText = (deck: DeckId): string =>
  deck === "world" ? "the World deck" : `the ${SIDE_NAME[deck]} Contingency deck`;

/** Cards by name, in order, or "no cards". */
const cardList = (cards: string[], names: GameNames): string => cards.map(names.card).join(", ") || "no cards";

export const eventPresentation: EventPresentation = {
  cardDrawn: { log: (event, names) => `${SIDE_NAME[event.side]} drew ${names.card(event.card)}.` },
  cardDrawnHidden: { log: (event) => `${SIDE_NAME[event.side]} drew a card.` },
  marker: {
    log: (event) =>
      event.value === undefined ? `Marker ${event.label}.` : `Marker ${event.label}: ${shown(event.value)}.`,
  },
  pointsSpent: { log: (event) => `${SIDE_NAME[event.side]} spent ${event.amount} points.` },
  influencePlaced: {
    log: (event) =>
      `${SIDE_NAME[event.side]} placed 1 influence in ${event.country} for ${event.cost} point${event.cost === 1 ? "" : "s"}.`,
  },
  realigned: {
    log: (event) =>
      `${SIDE_NAME[event.side]} realigned in ${event.country}: LIO ${event.totals.lio}, SAE ${event.totals.sae}. ` +
      (event.loser === null ? "A tie: nothing changed." : `${SIDE_NAME[event.loser]} lost ${event.removed} influence.`),
  },
  intervened: {
    log: (event) =>
      `${SIDE_NAME[event.side]} intervened in ${event.country}: draw ${event.draw} + ${event.points} point${event.points === 1 ? "" : "s"} - 2 x stability ` +
      `${event.stability} = ${event.result}` +
      (event.result > 0 ? `; removed ${event.removed} rival influence, added ${event.added} own.` : "; no change."),
  },
  drawPileReshuffled: {
    log: (event) => `The draw pile ran out: ${event.cards} discarded cards were shuffled into a new one.`,
  },
  eraStarted: {
    log: (event, names) => `${names.era(event.era)} started: ${event.cardsAdded} cards shuffled into the draw pile.`,
  },
  contingencyDrawn: { log: (event) => `A contingency was drawn from ${deckText(event.deck)}: ${event.value}.` },
  contingencyDeckReshuffled: {
    log: (event) =>
      `${event.deck === "world" ? "The World deck" : `${SIDE_NAME[event.deck]}'s Contingency deck`} was shuffled back together.`,
  },
  modifierStarted: {
    log: (event, names) => `${names.card(event.source)}: ${modifierText(event.mod)}, until the end of the turn.`,
  },
  modifierEnded: { log: (event, names) => `${names.card(event.source)}'s change ended: ${modifierText(event.mod)}.` },
  triggerSet: { log: (event, names) => `${names.card(event.source)} set a reaction ${HOOK_TEXT[event.hook]}.` },
  triggerFired: { log: (event, names) => `${names.card(event.source)}'s reaction ran (${HOOK_TEXT[event.hook]}).` },
  triggerEnded: { log: (event, names) => `${names.card(event.source)}'s reaction ended (${HOOK_TEXT[event.hook]}).` },
  handRevealed: {
    log: (event, names) => `${SIDE_NAME[event.side]}'s hand was shown to you: ${cardList(event.cards, names)}.`,
  },
  handRevealedHidden: {
    log: (event) => `${SIDE_NAME[event.side]}'s hand of ${event.cards} cards was shown to the other side.`,
  },
  cardsDiscarded: { log: (event, names) => `${SIDE_NAME[event.side]} discarded ${cardList(event.cards, names)}.` },
  escalationChanged: {
    log: (event) => `Escalation ${event.to > event.from ? "rises" : "falls"} to ${event.to}.`,
  },
  escalationCrisis: {
    log: (event) => `Crisis: ${SIDE_NAME[event.side]} draws ${event.value}; Escalation drops to 3.`,
  },
};

/** A modifier in words, such as "ops values for both sides -1, minimum 1". */
function modifierText(mod: ModifierSpec): string {
  const who = mod.side === "both" ? "both sides" : SIDE_NAME[mod.side];
  const change = mod.add > 0 ? `+${mod.add}` : String(mod.add);
  const floor = mod.min === undefined ? "" : `, minimum ${mod.min}`;
  return `ops values for ${who} ${change}${floor}`;
}

/** One log line for an event, naming cards and eras by `names`. */
export function logLine(event: GameEvent, names: GameNames): string {
  return (eventPresentation[event.kind].log as (e: GameEvent, n: GameNames) => string)(event, names);
}
