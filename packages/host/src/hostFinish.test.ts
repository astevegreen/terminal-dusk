import { seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostSubmit } from "./hostSubmit.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset, SEED } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult, Submission } from "./types.ts";

/** Plays with first-choice answers until `stop` says to halt; returns every step. */
function play(stop: (host: HostResult) => boolean): HostResult[] {
  const steps = [started()];
  while (!stop(steps[steps.length - 1]!)) {
    const host = steps[steps.length - 1]!;
    steps.push(accept(host, submissionFor(host, nextSide(host)), NOW + steps.length));
  }
  return steps;
}
const ended = (h: HostResult): boolean => h.record.status.kind === "over";
const finalizes = (h: HostResult): number => h.effects.filter((e) => "finalize" in e).length;

describe("hostSubmit: the end of the game", () => {
  it("a game that ends by play reveals exactly the seed, and its hash matches the record", () => {
    const steps = play(ended);
    const last = steps[steps.length - 1]!;
    expect(last.record.seed).toBe(SEED);
    expect(seedHash(last.record.seed!)).toBe(last.record.seedHash);
  });

  it("a game that ends by resignation reveals exactly the seed, and its hash matches the record", () => {
    const next = accept(started(), { player: "alice", resign: true }, NOW + 1);
    expect(next.record.seed).toBe(SEED);
    expect(seedHash(next.record.seed!)).toBe(next.record.seedHash);
  });

  it("while the game is active the record has no seed key at all", () => {
    const steps = play(ended);
    for (const step of steps.slice(0, -1)) expect("seed" in step.record).toBe(false);
  });

  it("finalize appears once, on the answer that ends the game, and never before", () => {
    const steps = play(ended);
    expect(steps.map(finalizes)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(finalizes(accept(started(), { player: "bob", resign: true }, NOW + 1))).toBe(1);
  });

  it("the seed is in the record only, never in a frame", () => {
    const last = play(ended).at(-1)!;
    expect(JSON.stringify(last.frames)).not.toContain(JSON.stringify(SEED));
    expect(JSON.stringify(last.effects)).not.toContain(JSON.stringify(SEED));
  });

  it("a log with an answer removed makes the last answer fail with verifyFailed, changing nothing", () => {
    const steps = play((h) => h.record.seq === 7);
    const before = steps.at(-1)!;
    const tampered = deepFreeze({
      ...before,
      secret: { ...before.secret, log: before.secret.log.filter((_, i) => i !== 2) },
    });
    const submission = submissionFor(before, nextSide(before));
    const r = hostSubmit(ruleset, tampered.record, tampered.secret, submission, NOW + 20);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("verifyFailed");
    expect(r.error.message).not.toContain(SEED);
    expect(tampered.secret.log).toHaveLength(6);
    expect("seed" in tampered.record).toBe(false);
  });

  it("a state with two draw-pile cards swapped makes a resignation fail with verifyFailed, changing nothing", () => {
    const host = started();
    const [a, b, ...rest] = host.secret.state.secret.deck;
    const tampered = deepFreeze({
      ...host,
      secret: {
        ...host.secret,
        state: { ...host.secret.state, secret: { ...host.secret.state.secret, deck: [b!, a!, ...rest] } },
      },
    });
    const submission: Submission = { player: "alice", resign: true };
    const r = hostSubmit(ruleset, tampered.record, tampered.secret, submission, NOW + 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("verifyFailed");
    expect(r.error.message).not.toContain(SEED);
    expect("seed" in tampered.record).toBe(false);
  });

  it("after the end, any further answer or resignation is refused with gameOver", () => {
    const over = deepFreeze(play(ended).at(-1)!);
    for (const player of ["alice", "bob"]) {
      const r = hostSubmit(ruleset, over.record, over.secret, { player, resign: true }, over.record.updatedAt);
      expect(r.ok ? "ok" : r.error.code).toBe("gameOver");
    }
  });
});
