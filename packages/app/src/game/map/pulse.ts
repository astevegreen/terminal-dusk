// The pulse on the countries a move touched (L9, #489; docs/architecture.md, Decision 6: animation comes from
// events). Each new batch of events (a new frame's) flips a beat between 0 and 1; a touched marker carries the beat
// as data-pulse, and drawnMap.css runs one of two identical animations for each value. Changing the animation's
// name starts it again, so a country touched by two moves running pulses for each. A redraw with the same events
// keeps the beat, so it does not pulse again.
import type { GameEvent } from "@terminal-dusk/engine";

export type Beat = 0 | 1;
export type Pulse = { events: readonly GameEvent[]; beat: Beat };

/** The pulse after `events` arrive: the same one for the same events, otherwise the beat flipped. */
export function nextPulse(pulse: Pulse, events: readonly GameEvent[]): Pulse {
  return pulse.events === events ? pulse : { events, beat: pulse.beat === 0 ? 1 : 0 };
}
