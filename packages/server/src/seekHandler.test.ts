import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { CORS_HEADERS } from "./http.ts";
import { RANKED_LIMIT } from "./matchmake.ts";
import { MemorySeekStore } from "./seekStore.ts";
import { handleSeek } from "./seekHandler.ts";
import type { SeekHandlerDeps } from "./seekHandler.ts";
import { MemoryStore } from "./store.ts";
import { json as body, post } from "./test/handler.ts";

const TOKENS: Record<string, string> = { "token-owner": "owner", "token-free": "free", "token-other": "other" };

const T1 = "00000000-0000-4000-8000-000000000001";

function world() {
  const matches = new MemoryStore();
  const seeks = new MemorySeekStore(matches);
  const entitlements = new MemoryEntitlementStore([
    { player: "owner", platform: "web", source: "test" },
    { player: "other", platform: "web", source: "test" },
  ]);
  let n = 0;
  const deps: SeekHandlerDeps = {
    seeks,
    entitlements,
    matches,
    ticketId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    authenticate: (token) => Promise.resolve(TOKENS[token] ?? null),
    now: () => 1_700_000_000_000,
  };
  return { deps, seeks };
}

const CREATE = { action: "create", preset: "normal", side: "lio", platform: "web" };

describe("seek handler", () => {
  it("answers OPTIONS with the CORS headers and nothing else", async () => {
    const w = world();
    const reply = await handleSeek(w.deps, { method: "OPTIONS", authorization: null, body: "" });
    expect(reply).toEqual({ status: 204, headers: { ...CORS_HEADERS }, body: "" });
  });

  it("refuses every method but POST with 405", async () => {
    const reply = await handleSeek(world().deps, { ...post("token-owner", CREATE), method: "GET" });
    expect(reply.status).toBe(405);
  });

  it("refuses a caller who is not signed in with 401 and stores nothing", async () => {
    const w = world();
    const reply = await handleSeek(w.deps, post("token-nobody", CREATE));
    expect(reply.status).toBe(401);
    expect(await w.seeks.open()).toEqual([]);
  });

  it("stores a ticket for an owner of the Full Game and returns its id", async () => {
    const w = world();
    const reply = await handleSeek(w.deps, post("token-owner", CREATE));
    expect(reply.status).toBe(200);
    expect(body(reply)).toEqual({ ok: true, ticketId: T1 });
    expect(await w.seeks.open()).toMatchObject([{ id: T1, player: "owner", preset: "normal", side: "lio" }]);
  });

  it("takes no side preference as null", async () => {
    const w = world();
    await handleSeek(w.deps, post("token-owner", { action: "create", preset: "fast", platform: "web" }));
    expect(await w.seeks.open()).toMatchObject([{ preset: "fast", side: null }]);
  });

  it("refuses a free player with 403 notEntitled and stores nothing", async () => {
    const w = world();
    const reply = await handleSeek(w.deps, post("token-free", CREATE));
    expect(reply.status).toBe(403);
    expect((body(reply) as { error: { code: string } }).error.code).toBe("notEntitled");
    expect(await w.seeks.open()).toEqual([]);
  });

  it("refuses a sixth ranked game with 409 limitReached", async () => {
    const w = world();
    for (let i = 0; i < RANKED_LIMIT; i++)
      expect((await handleSeek(w.deps, post("token-owner", CREATE))).status).toBe(200);
    const reply = await handleSeek(w.deps, post("token-owner", CREATE));
    expect(reply.status).toBe(409);
    expect((body(reply) as { error: { code: string } }).error.code).toBe("limitReached");
  });

  it("refuses an unknown preset with 422 and a body without an action with 400", async () => {
    const w = world();
    expect((await handleSeek(w.deps, post("token-owner", { ...CREATE, preset: "hourly" }))).status).toBe(422);
    expect((await handleSeek(w.deps, post("token-owner", "{}"))).status).toBe(400);
    expect((await handleSeek(w.deps, post("token-owner", { action: "create" }))).status).toBe(400);
  });

  it("cancels the caller's own ticket", async () => {
    const w = world();
    await handleSeek(w.deps, post("token-owner", CREATE));
    const reply = await handleSeek(w.deps, post("token-owner", { action: "cancel", ticketId: T1 }));
    expect(reply.status).toBe(200);
    expect(await w.seeks.open()).toEqual([]);
  });

  it("will not cancel another player's ticket, and says the same as for a ticket that is gone", async () => {
    const w = world();
    await handleSeek(w.deps, post("token-owner", CREATE));
    const theirs = await handleSeek(w.deps, post("token-other", { action: "cancel", ticketId: T1 }));
    const gone = await handleSeek(
      w.deps,
      post("token-owner", { action: "cancel", ticketId: "00000000-0000-4000-8000-000000000099" }),
    );
    expect(theirs.status).toBe(404);
    expect(gone.body).toBe(theirs.body);
    expect(await w.seeks.open()).toHaveLength(1);
  });

  it("answers a ticketId that is not a UUID with 404 ticketNotFound, without asking the store", async () => {
    const w = world();
    let asked = false;
    const spy = { ...w.deps, seeks: { cancel: () => ((asked = true), Promise.resolve(false)) } };
    const reply = await handleSeek(
      spy as unknown as SeekHandlerDeps,
      post("token-owner", { action: "cancel", ticketId: "not-a-uuid" }),
    );
    expect(reply.status).toBe(404);
    expect(body(reply)).toMatchObject({ error: { code: "ticketNotFound" } });
    expect(asked).toBe(false);
  });

  it("gives 500 storageFailed when the store throws on cancel", async () => {
    const w = world();
    const broken = { ...w.deps, seeks: { cancel: () => Promise.reject(new Error("db down")) } };
    const reply = await handleSeek(
      broken as unknown as SeekHandlerDeps,
      post("token-owner", { action: "cancel", ticketId: T1 }),
    );
    expect(reply.status).toBe(500);
    expect(reply.body).not.toContain("db down");
  });
});
