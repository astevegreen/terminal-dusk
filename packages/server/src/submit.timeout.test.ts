// A player can never end a game by sending a timeout: only the server's deadline job may (hostTimeout).
import { describe, expect, it } from "vitest";
import type { MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import { bodyFor, MATCH, NOW, setup } from "./test/match.ts";

/** Wraps a store so the test can count the commits that reach it. */
function counting(inner: MatchStore): { store: MatchStore; commits: () => number } {
  let commits = 0;
  return {
    store: {
      load: (id) => inner.load(id),
      commit: (id, seq, write) => {
        commits += 1;
        return inner.commit(id, seq, write);
      },
    },
    commits: () => commits,
  };
}

describe("submit: a timeout body from a player", () => {
  it("submit with { system: 'timeout' } or { timeout: true } does not end the game and saves nothing", async () => {
    const { deps, store, start } = setup();
    const { store: watched, commits } = counting(store);
    const answer = bodyFor(0, start.secret, "lio");
    const bodies = [
      { system: "timeout" },
      { timeout: true },
      { system: "timeout", side: "sae" },
      { timeout: true, side: "sae" },
      { system: "timeout", expectedSeq: 0 },
      { timeout: true, expectedSeq: 0, decisionId: answer.decisionId },
    ];
    const before = JSON.stringify(await store.load(MATCH));
    for (const body of bodies) {
      const result = await submit({ ...deps, store: watched }, { matchId: MATCH, player: "alice", body, now: NOW + 1 });
      expect(result.ok, JSON.stringify(body)).toBe(false);
    }
    expect(commits()).toBe(0);
    const after = await store.load(MATCH);
    expect(JSON.stringify(after)).toBe(before);
    expect(after?.record.status).toEqual({ kind: "active" });
  });
});
