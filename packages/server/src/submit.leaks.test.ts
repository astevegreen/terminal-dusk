import type { MatchSecret } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import type { SubmitDeps, SubmitOutcome } from "./submit.ts";
import { leaksIn } from "@terminal-dusk/host/test/secret-leaks";
import { bodyFor, MATCH, nextSide, NOW, setup } from "./test/match.ts";

const broken = (part: "load" | "commit", inner: MatchStore): MatchStore => ({
  load: part === "load" ? () => Promise.reject(new Error("load failed")) : (id) => inner.load(id),
  commit: part === "commit" ? () => Promise.reject(new Error("commit failed")) : (id, s, w) => inner.commit(id, s, w),
});

/** One result of every error the handler can give, for a new match. */
async function everyError(): Promise<{ secret: MatchSecret; results: SubmitOutcome[] }> {
  const { deps, start } = setup();
  const good = bodyFor(0, start.secret, "lio");
  const call = (d: SubmitDeps, body: unknown, player = "alice", matchId = MATCH, now = NOW) =>
    submit(d, { matchId, player, body, now });
  const results = await Promise.all([
    call(deps, good, "alice", "no-such-match"),
    call({ ...deps, ruleset: () => undefined }, good),
    call(deps, null),
    call(deps, "resign"),
    call(deps, good, "mallory"),
    call(deps, { ...good, expectedSeq: 9 }),
    call(deps, { ...good, value: 1 }),
    call(deps, { ...good, decisionId: "not-a-decision" }),
    call(deps, good, "alice", MATCH, NOW - 1),
    call({ ...deps, store: broken("load", deps.store) }, good),
    call({ ...deps, store: broken("commit", deps.store) }, good),
  ]);
  return { secret: start.secret, results };
}

describe("submit: no result gives away the secret", () => {
  it("the leak check finds the seed, the generator state, the Contingency order and a hidden card", () => {
    const { start } = setup();
    const found = leaksIn(JSON.stringify(start.secret), start.secret);
    expect(found).toEqual(expect.arrayContaining(["the seed", "the generator state", "lio's Contingency order"]));
    expect(found).toContain('card "l1"');
  });

  it("every error case's JSON holds no seed, generator state, Contingency order or hidden card", async () => {
    const { secret, results } = await everyError();
    const codes = results.map((r) => (r.ok ? "ok" : r.error.code));
    expect(new Set(codes)).toEqual(
      new Set([
        "matchNotFound",
        "unknownRuleset",
        "illegalAnswer",
        "notPlayer",
        "staleSeq",
        "invalidTime",
        "storageFailed",
        "unknownDecision",
      ]),
    );
    for (const result of results) expect(leaksIn(JSON.stringify(result), secret), JSON.stringify(result)).toEqual([]);
  });

  it("every successful answer of a whole game, and a resignation, holds none of them either", async () => {
    const { store, deps } = setup();
    let now = NOW;
    for (;;) {
      const loaded = (await store.load(MATCH))!;
      if (loaded.record.status.kind !== "active") break;
      const side = nextSide(loaded.secret);
      const player = loaded.record.players[side];
      const result = await submit(deps, {
        matchId: MATCH,
        player,
        body: bodyFor(loaded.record.seq, loaded.secret, side),
        now: ++now,
      });
      expect(result.ok).toBe(true);
      const after = (await store.load(MATCH))!;
      for (const secret of [loaded.secret, after.secret]) expect(leaksIn(JSON.stringify(result), secret)).toEqual([]);
    }
    const resigned = setup();
    const result = await submit(resigned.deps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW });
    expect(result.ok).toBe(true);
    expect(leaksIn(JSON.stringify(result), resigned.start.secret)).toEqual([]);
  });
});
