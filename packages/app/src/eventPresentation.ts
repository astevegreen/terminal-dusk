// How each EventKind is presented. A new kind without an entry here fails the type check (hard rule 9).
import type { EventKind, GameEvent } from "@terminal-dusk/engine";

/** Placeholder entries until the first UI task: one game-log line per event. */
export type EventPresentation = {
  [K in EventKind]: { log: (event: Extract<GameEvent, { kind: K }>) => string };
};

export const eventPresentation: EventPresentation = {
  cardDrawn: { log: (event) => `${event.side} drew ${event.card}.` },
  cardDrawnHidden: { log: (event) => `${event.side} drew a card.` },
  marker: {
    log: (event) =>
      event.value === undefined ? `Marker ${event.label}.` : `Marker ${event.label}: ${String(event.value)}.`,
  },
};
