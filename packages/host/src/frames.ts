// Shared by the host's entry points: building the three frames, and copying plain JSON.
import { eventsFor, pendingFor, viewFor } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Viewer } from "@terminal-dusk/engine";
import type { Frame } from "./types.ts";

/** One frame for each viewer: its view, the events it may see, and the decision waiting for it. */
export function framesFor(matchId: string, state: GameState, events: readonly GameEvent[]): Record<Viewer, Frame> {
  const frame = (viewer: Viewer): Frame => ({
    matchId,
    seq: state.meta.seq,
    viewer,
    ruleset: state.meta.ruleset,
    view: viewFor(state, viewer),
    events: copyJson(eventsFor(events, viewer)),
    decision: viewer === "spectator" ? null : copyJson(pendingFor(state, viewer)),
  });
  return { lio: frame("lio"), sae: frame("sae"), spectator: frame("spectator") };
}

/** A deep copy of plain JSON data, so the result shares nothing with the inputs or the engine's state. */
export const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
