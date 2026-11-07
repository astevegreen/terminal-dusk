import { describe, expect, it } from "vitest";
import { hostCreate } from "./hostCreate.ts";
import { leaksFor } from "./test/secretLeaks.ts";
import { LATE_ERA_CARDS, makeConfig, NOW, ruleset, SEED } from "./test/match.ts";
import type { HostResult } from "./types.ts";

function started(): HostResult {
  const r = hostCreate(ruleset, makeConfig(), SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

describe("hostCreate: nothing hidden leaves the secret", () => {
  it("the test setup has an era still waiting to enter, so the era-card check tests something", () => {
    const { secret } = started();
    expect(secret.state.secret.eras.flatMap((e) => e.cards)).toEqual(LATE_ERA_CARDS);
    for (const card of LATE_ERA_CARDS) {
      expect(leaksFor(JSON.stringify({ card }), secret, "spectator")).toEqual([`card "${card}"`]);
    }
  });

  it("the leak check finds a hidden card, the seed and the generator state when they are there", () => {
    const { secret } = started();
    const text = JSON.stringify({ card: LATE_ERA_CARDS[0], seed: SEED, rng: secret.state.secret.rng });
    expect(leaksFor(text, secret, "lio")).toEqual(["the seed", "the generator state", `card "${LATE_ERA_CARDS[0]}"`]);
  });

  it("the record's JSON holds no seed, generator state or card hidden from anyone", () => {
    const { record, secret } = started();
    // The spectator may see neither hand, the draw pile nor the waiting eras: every card the game holds.
    expect(leaksFor(JSON.stringify(record), secret, "spectator")).toEqual([]);
  });

  it("each frame's JSON holds no seed, generator state or card that viewer may not see", () => {
    const { frames, secret } = started();
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(leaksFor(JSON.stringify(frames[viewer]), secret, viewer), viewer).toEqual([]);
    }
  });

  it("the spectator's frame holds no hand card at all", () => {
    const { frames, secret } = started();
    const hands = [...secret.state.private.lio.hand, ...secret.state.private.sae.hand];
    expect(hands.length).toBeGreaterThan(0);
    expect(frames.spectator.view.mine).toBeNull();
    for (const card of hands) expect(JSON.stringify(frames.spectator)).not.toContain(JSON.stringify(card));
  });

  it("each side's frame does show that side's own hand, so the check is not passing by showing nothing", () => {
    const { frames, secret } = started();
    expect(frames.lio.view.mine?.hand).toEqual(secret.state.private.lio.hand);
    expect(frames.sae.view.mine?.hand).toEqual(secret.state.private.sae.hand);
  });
});
