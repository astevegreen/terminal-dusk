// Filtering events by who may see them.
import type { GameEvent, Viewer } from "./types.ts";

/**
 * The events `viewer` may see, in their original order: each event itself if it is public or
 * visible to the viewer, else its `publicForm` if it has one, else nothing.
 */
export function eventsFor(events: readonly GameEvent[], viewer: Viewer): GameEvent[] {
  const seen: GameEvent[] = [];
  for (const event of events) {
    if (event.visibility === "public" || event.visibility === viewer) seen.push(event);
    else if ("publicForm" in event && event.publicForm) seen.push(event.publicForm);
  }
  return seen;
}
