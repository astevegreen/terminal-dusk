import { describe, expect, it } from "vitest";
import type { MatchStore } from "./store.ts";
import { CORS_HEADERS, handleSubmit } from "./submitHandler.ts";
import type { HttpReply, SubmitHandlerDeps } from "./submitHandler.ts";
import { handlerWorld, json, post } from "./test/handler.ts";
import { bodyFor, MATCH, NOW } from "./test/match.ts";

const ALLOWED = ["authorization", "apikey", "content-type", "x-client-info"];

function expectCors(reply: HttpReply): void {
  expect(reply.headers["Access-Control-Allow-Origin"]).toBe("*");
  const allowed = reply.headers["Access-Control-Allow-Headers"]!.split(",").map((h) => h.trim());
  expect(allowed).toEqual(expect.arrayContaining(ALLOWED));
}

function expectRefused(reply: HttpReply, status: number, code: string): void {
  expect(reply.status).toBe(status);
  expect(json(reply)).toEqual({ ok: false, error: { code, message: expect.any(String) } });
  expect(reply.headers["Content-Type"]).toBe("application/json");
  expectCors(reply);
}

const broken = (inner: MatchStore): MatchStore => ({
  load: (id) => inner.load(id),
  commit: () => Promise.reject(new Error("commit failed")),
});

describe("submit handler: methods and CORS", () => {
  it("OPTIONS gets 204 with the CORS headers and an empty body", async () => {
    const world = handlerWorld();
    const reply = await handleSubmit(world.deps, { method: "OPTIONS", authorization: null, body: "" });
    expect(reply).toEqual({ status: 204, headers: { ...CORS_HEADERS }, body: "" });
    expectCors(reply);
    expect(world.storeCalls()).toBe(0);
  });

  it("every method but POST and OPTIONS gets 405 methodNotAllowed, and the store is never touched", async () => {
    const world = handlerWorld();
    for (const method of ["GET", "PUT", "DELETE", "PATCH", "HEAD", "post"]) {
      const good = bodyFor(0, world.start.secret, "lio");
      const reply = await handleSubmit(world.deps, {
        ...post("token-alice", { matchId: MATCH, submission: good }),
        method,
      });
      expectRefused(reply, 405, "methodNotAllowed");
    }
    expect(world.storeCalls()).toBe(0);
  });
});

describe("submit handler: signing in", () => {
  const headers: [string, string | null][] = [
    ["a missing header", null],
    ["an empty header", ""],
    ["a header with no Bearer scheme", "token-alice"],
    ["a Basic header", "Basic token-alice"],
    ["an empty token", "Bearer "],
    ["a whitespace-only token", "Bearer    "],
    ["a token with a space in it", "Bearer token alice"],
  ];
  for (const [name, authorization] of headers) {
    it(`${name} gives 401 notSignedIn without calling authenticate, and the store is never touched`, async () => {
      const world = handlerWorld();
      const body = JSON.stringify({ matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") });
      expectRefused(await handleSubmit(world.deps, { method: "POST", authorization, body }), 401, "notSignedIn");
      expect(world.authCalls).toEqual([]);
      expect(world.storeCalls()).toBe(0);
    });
  }

  it("authenticate returning null, an empty id, or throwing gives 401 notSignedIn, and the store is never touched", async () => {
    const fakes: SubmitHandlerDeps["authenticate"][] = [
      async () => null,
      async () => "",
      async () => {
        throw new Error("auth down");
      },
      () => Promise.reject(new Error("auth down")),
    ];
    for (const authenticate of fakes) {
      const world = handlerWorld();
      const request = post("token-alice", { matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") });
      expectRefused(await handleSubmit({ ...world.deps, authenticate }, request), 401, "notSignedIn");
      expect(world.storeCalls()).toBe(0);
    }
  });

  it("the player comes from authenticate, never from the request body, and the time from now()", async () => {
    const world = handlerWorld();
    const submission = { ...bodyFor(0, world.start.secret, "lio"), player: "bob" };
    const reply = await handleSubmit(world.deps, post("token-alice", { matchId: MATCH, player: "bob", submission }));
    expect(json(reply)).toEqual({ ok: true, seq: 1 });
    expect(world.authCalls).toEqual(["token-alice"]);
    const saved = world.memory.stored(MATCH)!;
    expect(saved.record.updatedAt).toBe(NOW + 1);
    // As bob (SAE) the same body would be refused: it answers LIO's decision.
    const asBob = handlerWorld();
    const refused = await handleSubmit(asBob.deps, post("token-bob", { matchId: MATCH, submission }));
    expect(refused.status).not.toBe(200);
  });
});

describe("submit handler: malformed requests give 400 illegalAnswer and never touch the store", () => {
  const bodies: [string, (good: unknown) => unknown][] = [
    ["a body that is not JSON", () => "{not json"],
    ["an empty body", () => ""],
    ["a JSON array", (good) => [MATCH, good]],
    ["JSON null", () => "null"],
    ["no matchId", (good) => ({ submission: good })],
    ["an empty matchId", (good) => ({ matchId: "", submission: good })],
    ["a number matchId", (good) => ({ matchId: 1, submission: good })],
    ["no submission", () => ({ matchId: MATCH })],
    ["a null submission", () => ({ matchId: MATCH, submission: null })],
    ["a string submission", () => ({ matchId: MATCH, submission: "resign" })],
    ["an array submission", (good) => ({ matchId: MATCH, submission: [good] })],
  ];
  for (const [name, make] of bodies) {
    it(name, async () => {
      const world = handlerWorld();
      const reply = await handleSubmit(world.deps, post("token-alice", make(bodyFor(0, world.start.secret, "lio"))));
      expectRefused(reply, 400, "illegalAnswer");
      expect(world.storeCalls()).toBe(0);
    });
  }
});

describe("submit handler: each outcome's status and JSON", () => {
  it("200: a legal answer gives { ok: true, seq } and nothing else (no effects)", async () => {
    const world = handlerWorld();
    const reply = await handleSubmit(
      world.deps,
      post("token-alice", { matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") }),
    );
    expect(reply.status).toBe(200);
    expect(json(reply)).toEqual({ ok: true, seq: 1 });
    expect(reply.headers["Content-Type"]).toBe("application/json");
    expectCors(reply);
  });

  it("200: a resignation gives { ok: true, seq }", async () => {
    const world = handlerWorld();
    const reply = await handleSubmit(world.deps, post("token-bob", { matchId: MATCH, submission: { resign: true } }));
    expect(json(reply)).toEqual({ ok: true, seq: 1 });
  });

  const cases: {
    name: string;
    status: number;
    code: string;
    token?: string;
    change?: (d: SubmitHandlerDeps) => SubmitHandlerDeps;
    body?: (good: Record<string, unknown>) => unknown;
  }[] = [
    { name: "a stranger", status: 403, code: "notPlayer", token: "token-mallory" },
    {
      name: "an unknown match",
      status: 404,
      code: "matchNotFound",
      body: (good) => ({ matchId: "no-such-match", submission: good }),
    },
    {
      name: "a stale seq",
      status: 409,
      code: "staleSeq",
      body: (good) => ({ matchId: MATCH, submission: { ...good, expectedSeq: 7 } }),
    },
    {
      name: "a ruleset the server does not have",
      status: 409,
      code: "unknownRuleset",
      change: (d) => ({ ...d, ruleset: () => undefined }),
    },
    { name: "a failed save", status: 500, code: "storageFailed", change: (d) => ({ ...d, store: broken(d.store) }) },
    {
      name: "a clock that throws",
      status: 500,
      code: "internalError",
      change: (d) => ({
        ...d,
        now: () => {
          throw new Error("no clock");
        },
      }),
    },
    {
      name: "an illegal answer the host refuses",
      status: 422,
      code: "illegalAnswer",
      body: (good) => ({ matchId: MATCH, submission: { ...good, value: 1 } }),
    },
    {
      name: "an unknown decision",
      status: 422,
      code: "unknownDecision",
      body: (good) => ({ matchId: MATCH, submission: { ...good, decisionId: "nope" } }),
    },
    {
      name: "a time before the match's last change",
      status: 422,
      code: "invalidTime",
      change: (d) => ({ ...d, now: () => NOW - 1 }),
    },
  ];
  for (const c of cases) {
    it(`${c.status} ${c.code}: ${c.name}`, async () => {
      const world = handlerWorld();
      const good = bodyFor(0, world.start.secret, "lio");
      const deps = c.change ? c.change(world.deps) : world.deps;
      const reply = await handleSubmit(
        deps,
        post(c.token ?? "token-alice", c.body ? c.body(good) : { matchId: MATCH, submission: good }),
      );
      expectRefused(reply, c.status, c.code);
      expect(world.memory.stored(MATCH)!.record.seq).toBe(0);
    });
  }

  it("500 internalError has a fixed message, and the handler never throws", async () => {
    const world = handlerWorld();
    const throwing = {
      ...world.deps,
      now: () => {
        throw new Error("secret detail");
      },
    };
    const request = post("token-alice", { matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") });
    const first = await handleSubmit(throwing, request);
    const second = await handleSubmit(
      {
        ...throwing,
        now: () => {
          throw "other";
        },
      },
      request,
    );
    expect(first.body).toBe(second.body);
    expect(first.body).not.toContain("secret detail");
  });

  it("a logger that throws does not change the reply", async () => {
    const world = handlerWorld();
    const deps = {
      ...world.deps,
      log: () => {
        throw new Error("log down");
      },
    };
    const reply = await handleSubmit(
      deps,
      post("token-alice", { matchId: MATCH, submission: bodyFor(0, world.start.secret, "lio") }),
    );
    expect(json(reply)).toEqual({ ok: true, seq: 1 });
  });
});
