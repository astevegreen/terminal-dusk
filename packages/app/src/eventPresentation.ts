// How each EventKind is presented. A new kind without an entry here fails the type check (hard rule 9).
import { SIDES } from "@terminal-dusk/engine";
import type { EventKind, GameEvent, ModifierSpec, VarValue } from "@terminal-dusk/engine";

/** Placeholder entries until the first UI task: one game-log line per event. */
export type EventPresentation = {
  [K in EventKind]: { log: (event: Extract<GameEvent, { kind: K }>) => string };
};

/** A marker's value as text: both sides' answers read "lio yes, sae no", in SIDES order. */
const shown = (value: VarValue): string =>
  typeof value === "object" ? SIDES.map((side) => `${side} ${value[side] ? "yes" : "no"}`).join(", ") : String(value);

export const eventPresentation: EventPresentation = {
  cardDrawn: { log: (event) => `${event.side} drew ${event.card}.` },
  cardDrawnHidden: { log: (event) => `${event.side} drew a card.` },
  marker: {
    log: (event) =>
      event.value === undefined ? `Marker ${event.label}.` : `Marker ${event.label}: ${shown(event.value)}.`,
  },
  pointsSpent: { log: (event) => `${event.side} spent ${event.amount} points.` },
  eraStarted: { log: (event) => `Era ${event.era} started: ${event.cardsAdded} cards shuffled into the draw pile.` },
  contingencyDrawn: { log: (event) => `${event.side} drew a contingency: ${event.value}.` },
  contingencyDeckReshuffled: {
    log: (event) => `${event.side}'s Contingency deck was shuffled back together.`,
  },
  modifierStarted: { log: (event) => `${event.source}: ${modifierText(event.mod)}, until the end of the turn.` },
  modifierEnded: { log: (event) => `${event.source}'s change ended: ${modifierText(event.mod)}.` },
};

/** A modifier in words, such as "ops values for both sides -1, minimum 1". */
function modifierText(mod: ModifierSpec): string {
  const who = mod.side === "both" ? "both sides" : mod.side;
  const change = mod.add > 0 ? `+${mod.add}` : String(mod.add);
  return `ops values for ${who} ${change}${mod.min === undefined ? "" : `, minimum ${mod.min}`}`;
}
