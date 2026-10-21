import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { readMatch } from "./read.ts";
import type { Caller } from "./read.ts";
import { playGame, STRATEGIES } from "./test/games.ts";
import { leaksFor } from "./test/leaks.ts";
import { created, MATCH } from "./test/match.ts";

/** Each caller, and the viewer whose hidden cards it may see: alice plays LIO, bob plays SAE. */
const CALLERS: { caller: Caller; viewer: Side | "spectator" }[] = [
  { caller: "alice", viewer: "lio" },
  { caller: "bob", viewer: "sae" },
  { caller: "carol", viewer: "spectator" },
  { caller: null, viewer: "spectator" },
];

describe("leaksFor: the read model's leak check", () => {
  it("finds the seed, the generator state, the Contingency order and the other side's hand, but not your own", () => {
    const { secret } = created();
    const text = JSON.stringify(secret);
    expect(leaksFor(text, secret, "lio")).toEqual(
      expect.arrayContaining(["the seed", "the generator state", "lio's Contingency order", 'card "s1"']),
    );
    expect(leaksFor(text, secret, "lio")).not.toContain('card "l1"');
    expect(leaksFor(text, secret, "spectator")).toEqual(expect.arrayContaining(['card "l1"', 'card "s1"']));
  });

  it("finds the other side's unrevealed opening pick, but not your own", async () => {
    let checked = false;
    await playGame(STRATEGIES[0]!, async ({ secret }) => {
      const pick = secret.state.private.lio.picks[0];
      if (checked || pick === undefined) return;
      const text = JSON.stringify(secret.state.private.lio);
      expect(leaksFor(text, secret, "sae")).toEqual(expect.arrayContaining(["lio's unrevealed pick"]));
      expect(leaksFor(text, secret, "spectator")).toEqual(expect.arrayContaining(["lio's unrevealed pick"]));
      expect(leaksFor(text, secret, "lio")).toEqual([]);
      checked = true;
    });
    expect(checked).toBe(true);
  });
});

describe("readMatch: no caller can read anything hidden from it", () => {
  for (const strategy of STRATEGIES) {
    it(`${strategy.name}: after every step, each caller's read holds nothing hidden from it`, async () => {
      let steps = 0;
      let over = false;
      await playGame(strategy, async ({ store, secret }) => {
        steps += 1;
        for (const { caller, viewer } of CALLERS) {
          const read = (await readMatch(store, MATCH, caller, -1))!;
          over = read.match.status.kind === "over";
          const text = JSON.stringify(read);
          // The seed is revealed in the match row once the game is over, and only then.
          const leaks = leaksFor(text, secret, viewer).filter((leak) => !(over && leak === "the seed"));
          expect(leaks, `${String(caller)} at seq ${read.match.seq}`).toEqual([]);
          if (viewer === "spectator") {
            expect(read.views.map((r) => r.viewer)).toEqual(["spectator"]);
            expect(new Set(read.events.map((r) => r.viewer))).toEqual(new Set(["spectator"]));
          }
        }
      });
      expect(over).toBe(true);
      expect(steps).toBeGreaterThan(1);
    });
  }
});
