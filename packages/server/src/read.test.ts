import { seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { canRead, readMatch } from "./read.ts";
import type { Caller } from "./read.ts";
import { rowsFor } from "./rows.ts";
import { submit } from "./submit.ts";
import { bodyFor, created, MATCH, NOW, SEED, setup } from "./test/match.ts";

const CALLERS: Caller[] = ["alice", "bob", "carol", null];

describe("canRead: who may read each row", () => {
  const { match, views, events } = rowsFor(created());
  const viewerRows = [...views, ...events];

  it("anyone may read a match row and the spectator rows, signed in or not", () => {
    for (const caller of CALLERS) {
      expect(canRead(caller, match, match)).toBe(true);
      for (const row of viewerRows.filter((r) => r.viewer === "spectator"))
        expect(canRead(caller, match, row)).toBe(true);
    }
  });

  it("the lio rows only the match's LIO player; the sae rows only its SAE player", () => {
    const allowed = { alice: "lio", bob: "sae" } as Record<string, string>;
    for (const caller of CALLERS) {
      for (const row of viewerRows.filter((r) => r.viewer !== "spectator")) {
        expect(canRead(caller, match, row), `${caller} reading ${row.viewer}`).toBe(
          caller !== null && allowed[caller] === row.viewer,
        );
      }
    }
  });

  it("it goes by the match row's players: the same id is refused for another match where it does not play", () => {
    const other = { ...match, lio_player: "dave" };
    const lioRow = views.find((r) => r.viewer === "lio")!;
    expect(canRead("alice", other, lioRow)).toBe(false);
    expect(canRead("dave", other, lioRow)).toBe(true);
  });
});

describe("readMatch: the rows a caller may read", () => {
  it("an unknown match gives null", async () => {
    const { store } = setup();
    expect(await readMatch(store, "no-such-match", "alice", -1)).toBeNull();
  });

  it("gives the match row, the readable view rows, and the readable event rows after afterSeq, oldest first", async () => {
    const { store, deps, start } = setup();
    await submit(deps, { matchId: MATCH, player: "alice", body: bodyFor(0, start.secret, "lio"), now: NOW });
    const loaded = (await store.load(MATCH))!;
    await submit(deps, { matchId: MATCH, player: "bob", body: bodyFor(1, loaded.secret, "sae"), now: NOW + 1 });
    const stored = (await store.rows(MATCH))!;

    const all = (await readMatch(store, MATCH, "alice", -1))!;
    expect(all.match).toEqual(stored.match);
    expect(all.views.map((r) => r.viewer)).toEqual(["lio", "spectator"]);
    expect(all.events.map((r) => [r.seq, r.viewer])).toEqual([
      [0, "lio"],
      [0, "spectator"],
      [1, "lio"],
      [1, "spectator"],
      [2, "lio"],
      [2, "spectator"],
    ]);
    const later = (await readMatch(store, MATCH, "bob", 1))!;
    expect(later.views.map((r) => r.viewer)).toEqual(["sae", "spectator"]);
    expect(later.events.map((r) => [r.seq, r.viewer])).toEqual([
      [2, "sae"],
      [2, "spectator"],
    ]);
    expect((await readMatch(store, MATCH, "alice", 2))!.events).toEqual([]);
  });

  it("a stranger and a signed-out caller get exactly the spectator rows", async () => {
    const { store } = setup();
    const stored = (await store.rows(MATCH))!;
    for (const caller of ["carol", null]) {
      expect(await readMatch(store, MATCH, caller, -1)).toEqual({
        match: stored.match,
        views: stored.views.filter((r) => r.viewer === "spectator"),
        events: stored.events.filter((r) => r.viewer === "spectator"),
      });
    }
  });

  it("once a game is over, the match row carries the seed and its seed_hash, so anyone can re-check it", async () => {
    const { store, deps } = setup();
    const before = (await readMatch(store, MATCH, null, -1))!;
    expect(before.match.seed).toBeNull();
    await submit(deps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW });
    for (const caller of CALLERS) {
      const { match } = (await readMatch(store, MATCH, caller, -1))!;
      expect(match.status.kind).toBe("over");
      expect(match.seed).toBe(SEED);
      expect(match.seed_hash).toBe(seedHash(SEED));
    }
  });
});
