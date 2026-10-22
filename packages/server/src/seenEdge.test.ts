import { describe, expect, it } from "vitest";
import type { FetchRequest } from "./edge.ts";
import { seenFetchHandler } from "./seenEdge.ts";
import { MATCH } from "./test/match.ts";
import { seenWorld, TOKEN_OF } from "./test/seen.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });

const request = (method: string, headers: Record<string, string>, text: () => Promise<string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text,
});

describe("seen Edge Function glue: fetch requests to handleSeen and back", () => {
  it("passes the method, the Authorization header and the body, and makes the 204 with a null body", async () => {
    const w = await seenWorld();
    const player = w.waiting[0]!;
    const body = JSON.stringify({ matchId: MATCH, seq: 0 });
    const made = await seenFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: `Bearer ${TOKEN_OF[player]}` }, async () => body));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
    expect(made.init.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(w.authCalls).toEqual([TOKEN_OF[player]]);
    expect(w.notifyCalls).toEqual([`seen ${MATCH} ${player} 0`]);
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const w = await seenWorld();
    const made = await seenFetchHandler(w.deps, make)(request("OPTIONS", {}, async () => ""));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });

  it("a refusal keeps its JSON body: 404 for a stranger", async () => {
    const w = await seenWorld();
    const body = JSON.stringify({ matchId: MATCH, seq: 0 });
    const made = await seenFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-mallory" }, async () => body));
    expect(made.init.status).toBe(404);
    expect(JSON.parse(made.body!)).toMatchObject({ ok: false, error: { code: "matchNotFound" } });
  });

  it("a body that cannot be read counts as empty: 400, store and queue never touched", async () => {
    const w = await seenWorld();
    const made = await seenFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-alice" }, () => Promise.reject(new Error("stream broke"))));
    expect(made.init.status).toBe(400);
    expect(w.storeCalls).toEqual([]);
    expect(w.notifyCalls).toEqual([]);
  });
});
