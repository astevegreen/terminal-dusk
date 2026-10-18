import { describe, expect, it } from "vitest";
import { hostCreate } from "./hostCreate.ts";
import { hiddenFrom, leaksIn } from "./test/leaks.ts";
import { LATE_ERA_CARDS, makeConfig, NOW, ruleset, SEED } from "./test/match.ts";
import type { HostResult } from "./types.ts";

function started(): HostResult {
  const r = hostCreate(ruleset, makeConfig(), SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

describe("hostCreate: nothing hidden leaves the secret", () => {
  it("the test setup has an era still waiting to enter, so the era-card check tests something", () => {
    const { state } = started().secret;
    expect(state.secret.eras.flatMap((e) => e.cards)).toEqual(LATE_ERA_CARDS);
    expect(hiddenFrom(state, "spectator")).toEqual(expect.arrayContaining(LATE_ERA_CARDS));
  });

  it("the leak check finds a hidden card, the seed and the generator state when they are there", () => {
    const { state } = started().secret;
    const text = JSON.stringify({ card: LATE_ERA_CARDS[0], seed: SEED, rng: state.secret.rng });
    expect(leaksIn(text, SEED, state, hiddenFrom(state, "lio"))).toEqual([
      "the seed",
      "the generator state",
      `card "${LATE_ERA_CARDS[0]}"`,
    ]);
  });

  it("the record's JSON holds no seed, generator state or card hidden from anyone", () => {
    const { record, secret } = started();
    const { state } = secret;
    // The spectator may see neither hand, the draw pile nor the waiting eras: every card the game holds.
    expect(leaksIn(JSON.stringify(record), SEED, state, hiddenFrom(state, "spectator"))).toEqual([]);
  });

  it("each frame's JSON holds no seed, generator state or card that viewer may not see", () => {
    const { frames, secret } = started();
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      const hidden = hiddenFrom(secret.state, viewer);
      expect(leaksIn(JSON.stringify(frames[viewer]), SEED, secret.state, hidden), viewer).toEqual([]);
    }
  });

  it("the spectator's frame holds no hand card at all", () => {
    const { frames, secret } = started();
    const hands = [...secret.state.private.lio.hand, ...secret.state.private.sae.hand];
    expect(hands.length).toBeGreaterThan(0);
    expect(frames.spectator.view.mine).toBeNull();
    expect(leaksIn(JSON.stringify(frames.spectator), SEED, secret.state, hands)).toEqual([]);
  });

  it("each side's frame does show that side's own hand, so the check is not passing by showing nothing", () => {
    const { frames, secret } = started();
    expect(frames.lio.view.mine?.hand).toEqual(secret.state.private.lio.hand);
    expect(frames.sae.view.mine?.hand).toEqual(secret.state.private.sae.hand);
  });
});
