import type { MatchSecret } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { MatchStore } from "./store.ts";
import { handleSubmit } from "./submitHandler.ts";
import type { HttpReply, HttpRequest, SubmitHandlerDeps } from "./submitHandler.ts";
import { handlerWorld, json, post } from "./test/handler.ts";
import type { HandlerWorld } from "./test/handler.ts";
import { leaksIn } from "./test/leaks.ts";
import { bodyFor, MATCH, nextSide, NOW, SEED } from "./test/match.ts";

const TOKEN_OF = { alice: "token-alice", bob: "token-bob" } as Record<string, string>;

const brokenLoad = (inner: MatchStore): MatchStore => ({
  load: () => Promise.reject(new Error("load failed")),
  commit: (id, seq, write) => inner.commit(id, seq, write),
});

/** One reply of every kind of refusal, for a new match, with each request sent. */
async function everyRefusal(world: HandlerWorld): Promise<{ requests: HttpRequest[]; replies: HttpReply[] }> {
  const good = bodyFor(0, world.start.secret, "lio");
  const send = (request: HttpRequest, deps: SubmitHandlerDeps = world.deps) => ({ request, deps });
  const calls = [
    send({ method: "GET", authorization: "Bearer token-alice", body: "" }),
    send(post(null, { matchId: MATCH, submission: good })),
    send(post("token-unknown", { matchId: MATCH, submission: good })),
    send(post("token-alice", "{not json")),
    send(post("token-alice", { matchId: MATCH })),
    send(post("token-mallory", { matchId: MATCH, submission: good })),
    send(post("token-alice", { matchId: "no-such-match", submission: good })),
    send(post("token-alice", { matchId: MATCH, submission: { ...good, expectedSeq: 9 } })),
    send(post("token-alice", { matchId: MATCH, submission: good }), { ...world.deps, ruleset: () => undefined }),
    send(post("token-alice", { matchId: MATCH, submission: good }), {
      ...world.deps,
      store: brokenLoad(world.deps.store),
    }),
    send(post("token-alice", { matchId: MATCH, submission: good }), {
      ...world.deps,
      now: () => {
        throw new Error(SEED);
      },
    }),
    send(post("token-alice", { matchId: MATCH, submission: { ...good, value: 1 } })),
    send(post("token-alice", { matchId: MATCH, submission: { ...good, decisionId: "nope" } })),
  ];
  const replies: HttpReply[] = [];
  for (const call of calls) replies.push(await handleSubmit(call.deps, call.request));
  return { requests: calls.map((c) => c.request), replies };
}

describe("submit handler: no reply or log line gives away the secret", () => {
  it("every refusal's reply holds no seed, generator state, Contingency order or hidden card", async () => {
    const world = handlerWorld();
    const { replies } = await everyRefusal(world);
    const statuses = new Set(replies.map((r) => r.status));
    expect(statuses).toEqual(new Set([400, 401, 403, 404, 405, 409, 422, 500]));
    for (const reply of replies) expect(leaksIn(JSON.stringify(reply), world.start.secret), reply.body).toEqual([]);
  });

  it("a whole game played through the handler: every reply is { ok: true, seq } and holds none of them", async () => {
    const world = handlerWorld();
    let replies = 0;
    for (;;) {
      const loaded = (await world.memory.load(MATCH))!;
      if (loaded.record.status.kind !== "active") break;
      const side = nextSide(loaded.secret);
      const token = TOKEN_OF[loaded.record.players[side]]!;
      const submission = bodyFor(loaded.record.seq, loaded.secret, side);
      const reply = await handleSubmit(world.deps, post(token, { matchId: MATCH, submission }));
      expect(reply.status).toBe(200);
      expect(json(reply)).toEqual({ ok: true, seq: loaded.record.seq + 1 });
      const after: MatchSecret = (await world.memory.load(MATCH))!.secret;
      for (const secret of [loaded.secret, after]) expect(leaksIn(JSON.stringify(reply), secret)).toEqual([]);
      replies++;
    }
    expect(replies).toBeGreaterThan(2);
    expect((await world.memory.load(MATCH))!.record.status.kind).not.toBe("active");
    // Once over, a further answer is refused, and that reply leaks nothing either.
    const over = await handleSubmit(world.deps, post("token-alice", { matchId: MATCH, submission: { resign: true } }));
    expect(over.status).toBe(422);
    expect(leaksIn(JSON.stringify(over), (await world.memory.load(MATCH))!.secret)).toEqual([]);
  });

  it("the logger gets only match ids, seqs and error codes: no token, body, state or seed", async () => {
    const world = handlerWorld();
    const { requests } = await everyRefusal(world);
    const good = bodyFor(0, world.start.secret, "lio");
    await handleSubmit(world.deps, post("token-alice", { matchId: MATCH, submission: good }));
    expect(world.logged.length).toBe(requests.length + 1);
    const text = world.logged.join("\n");
    for (const line of world.logged) {
      expect(line).toMatch(/^submit( match="[^"\n]*")?( seq=\d+| error=[A-Za-z]+)$/);
    }
    expect(text).toContain(`match="${MATCH}" seq=1`);
    for (const token of ["token-alice", "token-bob", "token-mallory", "token-unknown"])
      expect(text).not.toContain(token);
    for (const request of requests.filter((r) => r.body.length > 2)) expect(text).not.toContain(request.body);
    expect(text).not.toContain(JSON.stringify(good.value));
    expect(text).not.toContain(SEED);
    for (const secret of [world.start.secret, (await world.memory.load(MATCH))!.secret]) {
      expect(leaksIn(text, secret)).toEqual([]);
    }
    expect(text).not.toContain(String(NOW));
  });
});
