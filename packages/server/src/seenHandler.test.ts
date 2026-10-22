import { describe, expect, it } from "vitest";
import { CORS_HEADERS, preflight } from "./http.ts";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import { handleSeen } from "./seenHandler.ts";
import { post } from "./test/handler.ts";
import { MATCH, NOW } from "./test/match.ts";
import { seenWorld, TOKEN_OF } from "./test/seen.ts";

/** When every alert queued at NOW is old enough to email. */
const LATER = NOW + TURN_ALERT_DELAY_MS;

describe("handleSeen: a signed-in player marks their turn alert seen", () => {
  it("answers OPTIONS with the shared preflight, signing nobody in and touching no store", async () => {
    const w = await seenWorld();
    const reply = await handleSeen(w.deps, { method: "OPTIONS", authorization: null, body: "" });
    expect(reply).toEqual(preflight());
    expect(w.authCalls).toEqual([]);
    expect(w.storeCalls).toEqual([]);
    expect(w.notifyCalls).toEqual([]);
  });

  it("a waiting player's POST { matchId, seq } answers 204, after which due no longer returns their alert", async () => {
    const w = await seenWorld();
    const player = w.waiting[0]!;
    expect((await w.notify.due(LATER)).map((a) => a.player)).toContain(player);
    const reply = await handleSeen(w.deps, post(TOKEN_OF[player]!, { matchId: MATCH, seq: 0 }));
    expect(reply).toEqual({ status: 204, headers: { ...CORS_HEADERS }, body: "" });
    expect((await w.notify.due(LATER)).map((a) => a.player)).not.toContain(player);
    expect(w.notify.stored(MATCH, player)?.seen).toBe(true);
  });

  it("calls notify.seen(matchId, caller, seq) for the signed-in caller only, leaving the other player's alert", async () => {
    const w = await seenWorld();
    await w.notify.queue([{ matchId: MATCH, player: "alice", seq: 0, queuedAt: NOW }]);
    await w.notify.queue([{ matchId: MATCH, player: "bob", seq: 0, queuedAt: NOW }]);
    const reply = await handleSeen(w.deps, post("token-bob", { matchId: MATCH, seq: 0 }));
    expect(reply.status).toBe(204);
    expect(w.notifyCalls).toEqual([`seen ${MATCH} bob 0`]);
    expect(w.notify.stored(MATCH, "alice")?.seen).toBe(false);
  });

  it("logs only the match id and the seq it marked", async () => {
    const w = await seenWorld();
    await handleSeen(w.deps, post(TOKEN_OF[w.waiting[0]!]!, { matchId: MATCH, seq: 0 }));
    expect(w.logged).toEqual([`seen match=${JSON.stringify(MATCH)} seq=0`]);
  });
});

describe("handleSeen: a seq above the match's current seq is clamped to it", () => {
  it("marks the alert at the match's current seq, not the future seq the body names", async () => {
    const w = await seenWorld();
    const player = w.waiting[0]!;
    const reply = await handleSeen(w.deps, post(TOKEN_OF[player]!, { matchId: MATCH, seq: 7 }));
    expect(reply.status).toBe(204);
    expect(w.notifyCalls).toEqual([`seen ${MATCH} ${player} 0`]);
    expect(w.logged).toEqual([`seen match=${JSON.stringify(MATCH)} seq=0`]);
  });

  it("so a player cannot mark a later turn seen: an alert above the match's seq stays due", async () => {
    const w = await seenWorld();
    // An alert for a turn the match has not reached in the store the handler reads (as when a move is saved
    // between the handler's read and its call to the queue).
    await w.notify.queue([{ matchId: MATCH, player: "alice", seq: 2, queuedAt: NOW }]);
    const reply = await handleSeen(w.deps, post("token-alice", { matchId: MATCH, seq: 99 }));
    expect(reply.status).toBe(204);
    expect(w.notify.stored(MATCH, "alice")?.seen).toBe(false);
    expect(await w.notify.due(LATER)).toContainEqual({ matchId: MATCH, player: "alice", seq: 2, queuedAt: NOW });
  });

  it("a seq at or below the match's seq is passed on unchanged", async () => {
    const w = await seenWorld();
    await handleSeen(w.deps, post("token-alice", { matchId: MATCH, seq: 0 }));
    expect(w.notifyCalls).toEqual([`seen ${MATCH} alice 0`]);
  });
});

describe("handleSeen writes nothing else", () => {
  it("makes no commit, and the match, its secret, frames, view rows and event rows are unchanged", async () => {
    const w = await seenWorld();
    const storedBefore = w.memory.stored(MATCH);
    const rowsBefore = await w.memory.rows(MATCH);
    const reply = await handleSeen(w.deps, post(TOKEN_OF[w.waiting[0]!]!, { matchId: MATCH, seq: 0 }));
    expect(reply.status).toBe(204);
    expect(w.storeCalls).toEqual(["load"]);
    expect(w.notifyCalls).toHaveLength(1);
    expect(w.notifyCalls[0]).toMatch(/^seen /);
    expect(w.memory.stored(MATCH)).toEqual(storedBefore);
    expect(await w.memory.rows(MATCH)).toEqual(rowsBefore);
  });
});
