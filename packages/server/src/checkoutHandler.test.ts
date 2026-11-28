import { describe, expect, it } from "vitest";
import { handleCheckout } from "./checkoutHandler.ts";
import type { CheckoutHandlerDeps } from "./checkoutHandler.ts";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import type { EntitlementRow, EntitlementStore } from "./entitlementStore.ts";
import { preflight } from "./http.ts";
import type { HttpReply, HttpRequest } from "./http.ts";
import { paddleCheckout } from "./paddleCheckout.ts";
import { answers, created, fakePaddle, PADDLE, PAY_URL } from "./test/checkout.ts";

const TOKENS: Record<string, string> = { "token-alice": "player-alice", "token-bob": "player-bob" };

const post = (token: string | null, body = "{}"): HttpRequest => ({
  method: "POST",
  authorization: token === null ? null : `Bearer ${token}`,
  body,
});
const json = (reply: HttpReply): { ok: boolean; url?: string; error?: { code: string; message: string } } =>
  JSON.parse(reply.body);

type World = {
  owned?: EntitlementRow[];
  paddle?: ReturnType<typeof fakePaddle>;
  change?: Partial<CheckoutHandlerDeps>;
};

function world({ owned = [], paddle = fakePaddle(), change = {} }: World = {}) {
  const logs: string[] = [];
  const deps: CheckoutHandlerDeps = {
    authenticate: async (token) => TOKENS[token] ?? null,
    entitlements: new MemoryEntitlementStore(owned),
    checkout: paddleCheckout(PADDLE, paddle.fetch),
    log: (line) => logs.push(line),
    ...change,
  };
  return { deps, paddle, logs };
}

const expectRefusal = (reply: HttpReply, status: number, code: string) => {
  expect(reply.status).toBe(status);
  expect(reply.headers["Access-Control-Allow-Origin"]).toBe("*");
  expect(json(reply)).toEqual({ ok: false, error: { code, message: expect.stringMatching(/\w/) } });
};

describe("handleCheckout: a signed-in player gets a Paddle checkout address", () => {
  it("answers OPTIONS with the shared preflight and asks Paddle nothing", async () => {
    const w = world();
    expect(await handleCheckout(w.deps, { method: "OPTIONS", authorization: null, body: "" })).toEqual(preflight());
    expect(w.paddle.calls).toEqual([]);
  });

  it("200: returns Paddle's checkout address unchanged", async () => {
    const w = world();
    const reply = await handleCheckout(w.deps, post("token-alice"));
    expect(reply.status).toBe(200);
    expect(reply.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(json(reply)).toEqual({ ok: true, url: PAY_URL });
    expect(w.logs).toEqual(["checkout outcome=created"]);
  });

  it("asks Paddle for one copy at the set price, for the caller, opening on the app's pay page", async () => {
    const w = world();
    await handleCheckout(w.deps, post("token-alice"));
    expect(w.paddle.calls).toEqual([
      {
        url: "https://paddle.example.test/transactions",
        method: "POST",
        headers: { Authorization: "Bearer test-paddle-api-key", "Content-Type": "application/json" },
        body: {
          items: [{ price_id: "pri_test_full_game", quantity: 1 }],
          custom_data: { player_id: "player-alice" },
          checkout: { url: "https://play.example.test/pay/" },
        },
      },
    ]);
  });

  it("takes the player only from the token: nothing in the body changes the order", async () => {
    const w = world();
    const body = JSON.stringify({
      player_id: "player-bob",
      custom_data: { player_id: "player-bob" },
      items: [{ price_id: "pri_other", quantity: 9 }],
      checkout: { url: "https://elsewhere.example.test/" },
    });
    await handleCheckout(w.deps, post("token-alice", body));
    expect(w.paddle.calls[0]!.body).toEqual({
      items: [{ price_id: "pri_test_full_game", quantity: 1 }],
      custom_data: { player_id: "player-alice" },
      checkout: { url: "https://play.example.test/pay/" },
    });
  });

  it("401 notSignedIn for a missing, malformed or unknown token: Paddle is never asked", async () => {
    const headers = [null, "", "token-alice", "Bearer ", "Basic token-alice", "Bearer token-nobody"];
    for (const authorization of headers) {
      const w = world();
      const reply = await handleCheckout(w.deps, { method: "POST", authorization, body: "{}" });
      expectRefusal(reply, 401, "notSignedIn");
      expect(w.paddle.calls).toEqual([]);
    }
  });

  it("401 notSignedIn when the sign-in check itself fails", async () => {
    const w = world({ change: { authenticate: () => Promise.reject(new Error("auth down")) } });
    expectRefusal(await handleCheckout(w.deps, post("token-alice")), 401, "notSignedIn");
    expect(w.paddle.calls).toEqual([]);
  });

  it("405 methodNotAllowed for anything but POST and OPTIONS", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const w = world();
      const reply = await handleCheckout(w.deps, { ...post("token-alice"), method });
      expectRefusal(reply, 405, "methodNotAllowed");
      expect(w.paddle.calls).toEqual([]);
    }
  });

  it("409 alreadyOwned when the player has a web copy, bought or given: Paddle is never asked", async () => {
    for (const source of ["paddle", "gift code"]) {
      const w = world({ owned: [{ player: "player-alice", platform: "web", source }] });
      expectRefusal(await handleCheckout(w.deps, post("token-alice")), 409, "alreadyOwned");
      expect(w.paddle.calls).toEqual([]);
    }
  });

  it("another platform's copy, or another player's web copy, does not stop a web checkout", async () => {
    const w = world({
      owned: [
        { player: "player-alice", platform: "steam", source: "steam" },
        { player: "player-bob", platform: "web", source: "paddle" },
      ],
    });
    expect((await handleCheckout(w.deps, post("token-alice"))).status).toBe(200);
  });

  it("503 checkoutUnavailable when a setting is missing", async () => {
    const w = world({ change: { checkout: undefined } });
    expectRefusal(await handleCheckout(w.deps, post("token-alice")), 503, "checkoutUnavailable");
    expect(w.logs).toEqual(["checkout error=checkoutUnavailable reason=notConfigured"]);
  });

  it.each([
    ["refuses the key", async () => answers(403, { error: { code: "forbidden" } }), "status403"],
    ["refuses the order", async () => answers(400, { error: { code: "bad_request" } }), "status400"],
    ["is down", async () => answers(502, "<html>"), "status502"],
    ["can't be reached", () => Promise.reject(new Error("network down")), "unreachable"],
    [
      "answers with text that is not JSON",
      async () => ({ status: 201, json: () => Promise.reject(new Error("not JSON")) }),
      "badAnswer",
    ],
    ["answers with no data", async () => answers(201, {}), "badAnswer"],
    ["answers with nothing", async () => answers(201, null), "badAnswer"],
    ["gives no checkout", async () => answers(201, { data: { checkout: null } }), "badAnswer"],
    ["gives a null address", async () => created(null), "badAnswer"],
    ["gives an empty address", async () => created(""), "badAnswer"],
    ["gives an address that is not text", async () => created(42), "badAnswer"],
  ])("503 checkoutUnavailable when Paddle %s", async (_what, answer, reason) => {
    const w = world({ paddle: fakePaddle(answer) });
    expectRefusal(await handleCheckout(w.deps, post("token-alice")), 503, "checkoutUnavailable");
    expect(w.logs).toEqual([`checkout error=checkoutUnavailable reason=${reason}`]);
  });

  it("500 internalError when the player's copies can't be read: Paddle is never asked", async () => {
    const entitlements: EntitlementStore = { forPlayer: () => Promise.reject(new Error("db down")) };
    const w = world({ change: { entitlements } });
    expectRefusal(await handleCheckout(w.deps, post("token-alice")), 500, "internalError");
    expect(w.paddle.calls).toEqual([]);
  });

  it("a logger that throws never breaks a reply", async () => {
    const log = () => {
      throw new Error("log full");
    };
    const w = world({ change: { log } });
    expect((await handleCheckout(w.deps, post("token-alice"))).status).toBe(200);
    expectRefusal(await handleCheckout(w.deps, post(null)), 401, "notSignedIn");
  });

  it("logs and refusals carry no secret, token, player id, address or error text", async () => {
    const secretText = `Bearer ${PADDLE.apiKey} token-alice player-alice ${PAY_URL}`;
    const leaky = () => Promise.reject(new Error(secretText));
    const worlds: World[] = [
      {},
      { owned: [{ player: "player-alice", platform: "web", source: "paddle" }] },
      { change: { checkout: undefined } },
      { paddle: fakePaddle(leaky) },
      { paddle: fakePaddle(async () => answers(403, { error: { detail: secretText } })) },
      { paddle: fakePaddle(async () => ({ status: 201, json: leaky })) },
      { change: { entitlements: { forPlayer: leaky } } },
      { change: { authenticate: leaky } },
    ];
    const lines: string[] = [];
    const refusals: string[] = [];
    for (const setup of worlds) {
      const w = world(setup);
      const reply = await handleCheckout(w.deps, post("token-alice"));
      if (reply.status !== 200) refusals.push(reply.body);
      lines.push(...w.logs);
    }
    expect(lines).toHaveLength(worlds.length);
    for (const line of lines) expect(line).toMatch(/^checkout (outcome=\w+|error=\w+( reason=\w+)?)$/);
    for (const text of [...lines, ...refusals]) {
      expect(text).not.toMatch(/test-paddle-api-key|token-alice|player-alice|pri_test|_ptxn|example\.test/);
    }
  });
});
