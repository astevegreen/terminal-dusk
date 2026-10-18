// Filtering events by who may see them.
import type { GameEvent, ReplayViewer } from "./types.ts";

/**
 * The events `viewer` may see, in their original order: each event itself if it is public or
 * visible to the viewer, else its `publicForm` if it has one, else nothing. The replay-only
 * `omniscient` viewer sees every event in its own full form, never a `publicForm`.
 */
export function eventsFor(events: readonly GameEvent[], viewer: ReplayViewer): GameEvent[] {
  const seen: GameEvent[] = [];
  for (const event of events) {
    if (viewer === "omniscient" || event.visibility === "public" || event.visibility === viewer) seen.push(event);
    else if ("publicForm" in event && event.publicForm) seen.push(event.publicForm);
  }
  return seen;
}
