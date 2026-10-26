// The fuzz check for the Escalation track (R17a, docs/design/map-and-points.md, "Escalation"): checkStep (checks.ts)
// runs it on every state. Escalation only ever changes with an escalationChanged event, so the value before a step is
// the last such event's `to` in the game so far (2 before any), and the state must agree with the events.
import type { GameEvent, GameState, Setup } from "@terminal-dusk/engine";

/** Where a game with a map starts the track (map-and-points.md, "Escalation"). */
const START = 2;

/**
 * A game started without a map never has `escalation`. With a map, `escalation` is always a whole number from 0
 * to 6; each of the step's escalationChanged events starts from the value before it (the previous event's `to`, or
 * the value before the step), and the state's value is the last one's `to`, or unchanged when the step had none.
 * `allEvents` is every event of the game so far, the step's own `events` last.
 */
export function checkEscalation(
  setup: Setup,
  state: GameState,
  events: readonly GameEvent[],
  allEvents: readonly GameEvent[],
): void {
  const pub = state.public;
  if (setup.map === undefined) {
    if ("escalation" in pub) throw new Error("the game was started without a map, but its state has `escalation`");
    return;
  }
  const value: unknown = pub.escalation;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) {
    throw new Error(`Escalation is ${String(value)}, not a whole number from 0 to 6`);
  }
  let now = valueBefore(allEvents.slice(0, allEvents.length - events.length));
  for (const event of events) {
    if (event.kind !== "escalationChanged") continue;
    if (event.from !== now) {
      throw new Error(`an escalationChanged event goes from ${event.from}, but Escalation was ${now}`);
    }
    now = event.to;
  }
  if (value !== now) {
    throw new Error(`Escalation is ${value}, but the escalationChanged events so far leave it at ${now}`);
  }
}

/** Escalation after `events`: the last escalationChanged event's `to`, or the start if there is none. */
function valueBefore(events: readonly GameEvent[]): number {
  const last = events.findLast((event) => event.kind === "escalationChanged");
  return last?.kind === "escalationChanged" ? last.to : START;
}
