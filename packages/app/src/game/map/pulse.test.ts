// The pulse on the countries a move touched (L9, #489): each new batch of events starts it again, even on a country
// the last batch touched too, and a redraw with the same events does not.
import type { GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { nextPulse } from "./pulse.ts";

const placed = (country: string): GameEvent[] => [
  { kind: "influencePlaced", visibility: "public", side: "sae", country, cost: 1 },
];

describe("nextPulse", () => {
  it("keeps the same beat while the events are the same ones, so a redraw does not pulse again", () => {
    const events = placed("ukraine");
    const pulse = { events, beat: 0 as const };
    expect(nextPulse(pulse, events)).toBe(pulse);
  });
  it("flips the beat for each new batch of events, so the pulse starts again on a country touched twice running", () => {
    const first = { events: placed("ukraine"), beat: 0 as const };
    const second = nextPulse(first, placed("ukraine"));
    expect(second.beat).toBe(1);
    expect(nextPulse(second, placed("ukraine")).beat).toBe(0);
  });
});
