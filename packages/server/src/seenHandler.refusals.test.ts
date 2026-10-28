import { describe, expect, it } from "vitest";
import type { HttpReply } from "./http.ts";
import type { NotifyStore } from "./notifyStore.ts";
import { handleSeen } from "./seenHandler.ts";
import type { MatchStore } from "./store.ts";
import { json, post } from "./test/handler.ts";
import { leaksIn } from "@terminal-dusk/host/test/secret-leaks";
import { MATCH, SEED } from "./test/match.ts";
import { seenWorld } from "./test/seen.ts";
import type { SeenWorld } from "./test/seen.ts";

const error = (reply: HttpReply) => (json(reply) as { ok: false; error: { code: string } }).error.code;

/** Nothing was read or marked. */
const untouched = (w: SeenWorld) => {
  expect(w.storeCalls).toEqual([]);
  expect(w.notifyCalls).toEqual([]);
};

describe("handleSeen refusals", () => {
  it("a method other than POST or OPTIONS answers 405 methodNotAllowed", async () => {
    const w = await seenWorld();
    const reply = await handleSeen(w.deps, { method: "GET", authorization: "Bearer token-alice", body: "" });
    expect(reply.status).toBe(405);
    expect(error(reply)).toBe("methodNotAllowed");
    untouched(w);
  });

  it("a signed-out call answers 401 notSignedIn: no header, a malformed header or an unknown token", async () => {
    const w = await seenWorld();
    const body = { matchId: MATCH, seq: 0 };
    const replies = [
      await handleSeen(w.deps, post(null, body)),
      await handleSeen(w.deps, { ...post(null, body), authorization: "token-alice" }),
      await handleSeen(w.deps, post("token-unknown", body)),
    ];
    for (const reply of replies) {
      expect(reply.status).toBe(401);
      expect(error(reply)).toBe("notSignedIn");
    }
    untouched(w);
  });

  it("a bad body answers 400: not a JSON object, no matchId, or a seq that is not a non-negative integer", async () => {
    const w = await seenWorld();
    const bodies: unknown[] = [
      "{not json",
      "[]",
      "null",
      { seq: 0 },
      { matchId: "", seq: 0 },
      { matchId: 7, seq: 0 },
      { matchId: MATCH },
      { matchId: MATCH, seq: -1 },
      { matchId: MATCH, seq: 1.5 },
      { matchId: MATCH, seq: "0" },
      { matchId: MATCH, seq: null },
      { matchId: MATCH, seq: 2 ** 53 },
    ];
    for (const body of bodies) {
      const reply = await handleSeen(
        w.deps,
        post("token-alice", typeof body === "string" ? body : JSON.stringify(body)),
      );
      expect(reply.status, JSON.stringify(body)).toBe(400);
      expect(error(reply)).toBe("illegalAnswer");
    }
    untouched(w);
  });

  it("an unknown match answers 404 matchNotFound and marks nothing", async () => {
    const w = await seenWorld();
    const reply = await handleSeen(w.deps, post("token-alice", { matchId: "no-such-match", seq: 0 }));
    expect(reply.status).toBe(404);
    expect(error(reply)).toBe("matchNotFound");
    expect(w.notifyCalls).toEqual([]);
  });

  it("a caller who is not one of the match's two players answers 404 and marks nothing", async () => {
    const w = await seenWorld();
    const reply = await handleSeen(w.deps, post("token-mallory", { matchId: MATCH, seq: 0 }));
    expect(reply.status).toBe(404);
    expect(error(reply)).toBe("matchNotFound");
    expect(w.notifyCalls).toEqual([]);
  });

  it("the 404 for an unknown match and the 404 for a stranger are identical, so a stranger learns nothing", async () => {
    const w = await seenWorld();
    const unknown = await handleSeen(w.deps, post("token-mallory", { matchId: "no-such-match", seq: 0 }));
    const stranger = await handleSeen(w.deps, post("token-mallory", { matchId: MATCH, seq: 0 }));
    expect(stranger).toEqual(unknown);
  });
});

describe("handleSeen: a storage failure answers 500 with no stored data in the reply or log", () => {
  /** The thrown text carries the seed, so a reply or log line that repeats it would be caught. */
  const failing = () => Promise.reject(new Error(`storage broke: ${SEED}`));

  const check = (w: SeenWorld, reply: HttpReply) => {
    expect(reply.status).toBe(500);
    expect(error(reply)).toBe("storageFailed");
    const text = [reply.body, ...w.logged].join("\n");
    expect(text).not.toContain("storage broke");
    expect(leaksIn(text, w.start.secret)).toEqual([]);
  };

  it("a failing match read answers 500 storageFailed and marks nothing", async () => {
    const w = await seenWorld();
    const store: MatchStore = { load: failing, commit: failing };
    const reply = await handleSeen({ ...w.deps, store }, post("token-alice", { matchId: MATCH, seq: 0 }));
    check(w, reply);
    expect(w.notifyCalls).toEqual([]);
  });

  it("a failing seen call answers 500 storageFailed", async () => {
    const w = await seenWorld();
    const notify: NotifyStore = { ...w.deps.notify, seen: failing };
    const reply = await handleSeen({ ...w.deps, notify }, post("token-alice", { matchId: MATCH, seq: 0 }));
    check(w, reply);
  });

  it("a refusal's log line names only the match id and the error code", async () => {
    const w = await seenWorld();
    await handleSeen(w.deps, post("token-mallory", { matchId: MATCH, seq: 0 }));
    expect(w.logged).toEqual([`seen match=${JSON.stringify(MATCH)} error=matchNotFound`]);
  });

  it("anything unexpected answers 500 internalError and marks nothing", async () => {
    const w = await seenWorld();
    // A stored record with no players list: reading it throws outside the storage calls.
    const store: MatchStore = { ...w.deps.store, load: async () => ({ record: { seq: 0 }, secret: null }) as never };
    const reply = await handleSeen({ ...w.deps, store }, post("token-alice", { matchId: MATCH, seq: 0 }));
    expect(reply.status).toBe(500);
    expect(error(reply)).toBe("internalError");
    expect(w.notifyCalls).toEqual([]);
  });
});
