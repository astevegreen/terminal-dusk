import { describe, expect, it } from "vitest";
import { hiddenFrom, leaksIn } from "./test/leaks.ts";
import { SEED } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult } from "./types.ts";

const VIEWERS = ["lio", "sae", "spectator"] as const;

/** Every step of a whole game played through the host, from the start to the end. */
function allSteps(): HostResult[] {
  const steps = [started()];
  while (steps[steps.length - 1]!.record.status.kind === "active") {
    const host = steps[steps.length - 1]!;
    steps.push(accept(host, submissionFor(host, nextSide(host)), 1_700_000_000_000 + steps.length));
  }
  return steps;
}

describe("hostSubmit: nothing hidden leaves the secret", () => {
  it("after every step, the record holds no seed, generator state or hidden card", () => {
    for (const step of allSteps()) {
      const { state } = step.secret;
      expect(leaksIn(JSON.stringify(step.record), SEED, state, hiddenFrom(state, "spectator"))).toEqual([]);
    }
  });

  it("after every step, each frame holds no seed, generator state or card that viewer may not see", () => {
    for (const step of allSteps()) {
      for (const viewer of VIEWERS) {
        const { state } = step.secret;
        const text = JSON.stringify(step.frames[viewer]);
        expect(leaksIn(text, SEED, state, hiddenFrom(state, viewer)), `${viewer} at ${step.record.seq}`).toEqual([]);
      }
    }
  });
});

describe("hostSubmit: a simultaneous pick stays hidden", () => {
  for (const first of ["lio", "sae"] as const) {
    it(`after ${first} picks, neither the other side's frame nor the spectator's shows the card`, () => {
      const start = started();
      const submission = submissionFor(start, first);
      const picked = JSON.stringify((submission as { value: { card: string } }).value.card);
      const half = accept(start, submission);
      const other = first === "lio" ? "sae" : "lio";
      expect(JSON.stringify(half.frames[first])).toContain(picked);
      expect(JSON.stringify(half.frames[other])).not.toContain(picked);
      expect(JSON.stringify(half.frames.spectator)).not.toContain(picked);
    });
  }
});
