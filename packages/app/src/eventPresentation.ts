// How each EventKind is presented. A new kind without an entry here fails the type check (hard rule 9).
import { SIDES } from "@terminal-dusk/engine";
import type { DeckId, EventKind, GameEvent, HookId, ModifierSpec, VarValue } from "@terminal-dusk/engine";

/** Placeholder entries until the first UI task: one game-log line per event. */
export type EventPresentation = {
  [K in EventKind]: { log: (event: Extract<GameEvent, { kind: K }>) => string };
};

/** When a trigger's hook happens, in words. */
const HOOK_TEXT: Record<HookId, string> = {
  cardPlayed: "whenever a card is played this turn",
  turnEnd: "at the end of this turn",
};

/** A marker's value as text: both sides' answers read "lio yes, sae no", in SIDES order. */
const shown = (value: VarValue): string =>
  typeof value === "object" ? SIDES.map((side) => `${side} ${value[side] ? "yes" : "no"}`).join(", ") : String(value);

/** A Contingency deck in words: "the lio Contingency deck", or "the World deck". */
const deckText = (deck: DeckId): string => (deck === "world" ? "the World deck" : `the ${deck} Contingency deck`);

export const eventPresentation: EventPresentation = {
  cardDrawn: { log: (event) => `${event.side} drew ${event.card}.` },
  cardDrawnHidden: { log: (event) => `${event.side} drew a card.` },
  marker: {
    log: (event) =>
      event.value === undefined ? `Marker ${event.label}.` : `Marker ${event.label}: ${shown(event.value)}.`,
  },
  pointsSpent: { log: (event) => `${event.side} spent ${event.amount} points.` },
  drawPileReshuffled: {
    log: (event) => `The draw pile ran out: ${event.cards} discarded cards were shuffled into a new one.`,
  },
  eraStarted: { log: (event) => `Era ${event.era} started: ${event.cardsAdded} cards shuffled into the draw pile.` },
  contingencyDrawn: { log: (event) => `A contingency was drawn from ${deckText(event.deck)}: ${event.value}.` },
  contingencyDeckReshuffled: {
    log: (event) =>
      `${event.deck === "world" ? "The World deck" : `${event.deck}'s Contingency deck`} was shuffled back together.`,
  },
  modifierStarted: { log: (event) => `${event.source}: ${modifierText(event.mod)}, until the end of the turn.` },
  modifierEnded: { log: (event) => `${event.source}'s change ended: ${modifierText(event.mod)}.` },
  triggerSet: { log: (event) => `${event.source} set a reaction ${HOOK_TEXT[event.hook]}.` },
  triggerFired: { log: (event) => `${event.source}'s reaction ran (${HOOK_TEXT[event.hook]}).` },
  triggerEnded: { log: (event) => `${event.source}'s reaction ended (${HOOK_TEXT[event.hook]}).` },
};

/** A modifier in words, such as "ops values for both sides -1, minimum 1". */
function modifierText(mod: ModifierSpec): string {
  const who = mod.side === "both" ? "both sides" : mod.side;
  const change = mod.add > 0 ? `+${mod.add}` : String(mod.add);
  const floor = mod.min === undefined ? "" : `, minimum ${mod.min}`;
  return `ops values for ${who} ${change}${floor}`;
}
