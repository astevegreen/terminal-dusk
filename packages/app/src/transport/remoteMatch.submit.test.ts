import type { GameEvent, Viewer } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import type { FakeRequest } from "./test/fakeSupabase.ts";
import { nextMove, rig, settle, watch } from "./test/remoteGame.ts";

const posts = (requests: FakeRequest[]): FakeRequest[] => requests.filter((q) => q.path === "/functions/v1/submit");

describe("remote transport: playing", () => {
  it("two players play a game to the end through two remote transports", async () => {
    const r = rig();
    const transports = { alice: r.transportAs("alice"), bob: r.transportAs("bob") };
    const seen = { lio: watch(transports.alice), sae: watch(transports.bob) };
    await settle();
    const all: Record<"lio" | "sae", GameEvent[]> = {
      lio: [...r.fake.current().frames.lio.events],
      sae: [...r.fake.current().frames.sae.events],
    };
    let steps = 0;
    while (r.fake.current().record.status.kind === "active") {
      const move = nextMove(r.fake.current());
      expect(await transports[move.player as "alice" | "bob"].submit(move.args)).toEqual({ ok: true });
      steps++;
      for (const v of ["lio", "sae"] as const) all[v].push(...r.fake.current().frames[v].events);
      r.timers.fire();
      await settle();
      for (const v of ["lio", "sae"] as const) expect(seen[v].frames.at(-1)!.seq).toBe(steps);
    }
    expect(steps).toBeGreaterThan(2);
    for (const v of ["lio", "sae"] as const) {
      expect(seen[v].frames.map((f) => f.seq)).toEqual(Array.from({ length: steps + 1 }, (_, i) => i));
      expect(seen[v].frames.flatMap((f) => f.events)).toEqual(all[v]);
      expect(seen[v].frames.at(-1)!.view.public.status.kind).not.toBe("active");
    }
  });

  it("a stale answer comes back as staleSeq, with the server's code unchanged", async () => {
    const r = rig();
    const move = nextMove(r.fake.current());
    const result = await r.transportAs(move.player).submit({ ...move.args, expectedSeq: 5 });
    expect(result).toEqual({ ok: false, error: { code: "staleSeq", message: "refused: staleSeq" } });
    expect(r.fake.current().record.seq).toBe(0);
  });

  it("resign sends { resign: true } for the match and ends the game", async () => {
    const r = rig();
    expect(await r.transportAs("bob").resign()).toEqual({ ok: true });
    const [post] = posts(r.fake.requests);
    expect(post!.method).toBe("POST");
    expect(post!.body).toEqual({ matchId: "match-1", submission: { resign: true } });
    expect(post!.headers.Authorization).toBe("Bearer token-bob");
    expect(r.fake.current().record.status.kind).not.toBe("active");
  });
});

describe("remote transport: refused without a request", () => {
  it("a signed-out caller gets notSignedIn for submit and resign, and nothing is requested", async () => {
    const r = rig();
    const move = nextMove(r.fake.current());
    for (const player of [null, "dave"]) {
      const t = r.transportAs(player); // dave has a player id but no token
      expect(await t.submit(move.args)).toMatchObject({ ok: false, error: { code: "notSignedIn" } });
      expect(await t.resign()).toMatchObject({ ok: false, error: { code: "notSignedIn" } });
    }
    expect(r.fake.requests).toEqual([]);
  });

  it("a signed-in caller in neither seat gets notPlayer, after the match is read, and nothing is posted", async () => {
    const r = rig();
    const move = nextMove(r.fake.current());
    const t = r.transportAs("carol");
    expect(await t.submit(move.args)).toMatchObject({ ok: false, error: { code: "notPlayer" } });
    expect(await t.resign()).toMatchObject({ ok: false, error: { code: "notPlayer" } });
    expect(r.fake.requests.map((q) => q.path)).toEqual(["/rest/v1/match"]);
  });

  it("an answer sent before the first match read waits for that read", async () => {
    const r = rig();
    const move = nextMove(r.fake.current());
    const release = r.fake.hold();
    const result = r.transportAs(move.player).submit(move.args);
    await settle();
    expect(r.fake.requests.map((q) => q.path)).toEqual(["/rest/v1/match"]);
    release();
    expect(await result).toEqual({ ok: true });
    expect(r.fake.requests.map((q) => q.path)).toEqual(["/rest/v1/match", "/functions/v1/submit"]);
  });
});

describe("remote transport: sending", () => {
  it.each([
    ["submit", "throw" as const],
    ["resign", "throw" as const],
    ["submit", 502],
  ])("a network failure on %s (%s) gives networkError with one request only", async (call, mode) => {
    const r = rig();
    const move = nextMove(r.fake.current());
    const t = r.transportAs(move.player);
    watch(t);
    await settle();
    r.fake.failNext(mode);
    const result = call === "submit" ? await t.submit(move.args) : await t.resign();
    expect(result).toMatchObject({ ok: false, error: { code: "networkError" } });
    expect(posts(r.fake.requests)).toHaveLength(1);
    expect(r.fake.current().record.seq).toBe(0);
  });

  it("two answers sent together are posted one after the other, in order", async () => {
    const r = rig();
    const move = nextMove(r.fake.current());
    const t = r.transportAs(move.player);
    watch(t);
    await settle();
    const release = r.fake.hold();
    const first = t.submit(move.args);
    const second = t.resign();
    await settle();
    expect(posts(r.fake.requests)).toHaveLength(1);
    release();
    expect(await first).toEqual({ ok: true });
    expect(await second).toEqual({ ok: true });
    expect(posts(r.fake.requests).map((q) => q.body)).toEqual([
      { matchId: "match-1", submission: move.args },
      { matchId: "match-1", submission: { resign: true } },
    ]);
  });
});

describe("remote transport: what it asks for", () => {
  it("every request asks only for the caller's own rows, never match_secret, and writes nothing to a table", async () => {
    const own: [string | null, Viewer][] = [
      ["alice", "lio"],
      ["bob", "sae"],
      ["carol", "spectator"],
      [null, "spectator"],
    ];
    for (const [player, viewer] of own) {
      const r = rig();
      const t = r.transportAs(player);
      watch(t);
      await settle();
      r.fake.commit(nextMove(r.fake.current()).submission);
      r.timers.fire();
      await settle();
      await t.resign();
      expect(r.fake.requests.length).toBeGreaterThan(3);
      for (const q of r.fake.requests) {
        expect(q.headers.apikey).toBe("fake-anon-key");
        expect(q.headers.Authorization).toBe(player === null ? undefined : `Bearer token-${player}`);
        expect(q.path).not.toContain("match_secret");
        if (q.path.startsWith("/rest/v1/")) {
          expect(q.method).toBe("GET");
          expect(["/rest/v1/match", "/rest/v1/match_view", "/rest/v1/match_event"]).toContain(q.path);
          expect(q.params).toContainEqual(["match_id", "eq.match-1"]);
          if (q.path !== "/rest/v1/match") expect(q.params).toContainEqual(["viewer", `eq.${viewer}`]);
          expect(q.params.filter(([k]) => k === "viewer")).toHaveLength(q.path === "/rest/v1/match" ? 0 : 1);
        } else {
          // Only the two players tell the seen function about a turn (O8h); anyone may try to submit.
          expect(
            viewer === "spectator" ? ["/functions/v1/submit"] : ["/functions/v1/submit", "/functions/v1/seen"],
          ).toContain(q.path);
          expect(q.method).toBe("POST");
        }
      }
    }
  });
});
