// The wiring the `checkout` Edge Function serves with: the fetch glue and the settings read from the environment.
// The Deno entry only calls these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { checkoutDeps, checkoutFetchHandler } from "./checkoutEdge.ts";
import type { FetchRequest } from "./edge.ts";
import { MemoryCheckoutLimitStore } from "./checkoutLimitStore.ts";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { paddleCheckout } from "./paddleCheckout.ts";
import { SupabaseCheckoutLimitStore } from "./supabaseCheckoutLimitStore.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { fakePaddle, PADDLE, PAY_URL } from "./test/checkout.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });
const db = {} as unknown as SupabaseClient;
const ENV = {
  PADDLE_API_BASE: PADDLE.apiBase,
  PADDLE_API_KEY: PADDLE.apiKey,
  PADDLE_PRICE_ID: PADDLE.priceId,
  APP_URL: PADDLE.appUrl,
};

const request = (method: string, headers: Record<string, string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: async () => "{}",
});

describe("checkout Edge Function glue: fetch requests to handleCheckout and back", () => {
  const paddle = fakePaddle();
  const handle = checkoutFetchHandler(
    {
      authenticate: async (token) => (token === "token-alice" ? "player-alice" : null),
      entitlements: new MemoryEntitlementStore(),
      limit: new MemoryCheckoutLimitStore(),
      now: () => 1_700_000_000_000,
      checkout: paddleCheckout(PADDLE, paddle.fetch),
    },
    make,
  );

  it("passes the method and the Authorization header: alice gets the checkout address", async () => {
    const made = await handle(request("POST", { authorization: "Bearer token-alice" }));
    expect(made.init.status).toBe(200);
    expect(made.init.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(JSON.parse(made.body!)).toEqual({ ok: true, url: PAY_URL });
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const made = await handle(request("OPTIONS", {}));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });
});

describe("checkoutDeps", () => {
  const asked = async (env: Record<string, string | undefined>) => {
    const paddle = fakePaddle();
    const deps = checkoutDeps(env, db, { fetch: paddle.fetch, log: () => {} });
    await deps.checkout?.("player-alice");
    return { deps, calls: paddle.calls };
  };

  it("reads Paddle's settings and the app's address from the environment, and reads copies from Supabase", async () => {
    const { deps, calls } = await asked(ENV);
    expect(deps.entitlements).toBeInstanceOf(SupabaseEntitlementStore);
    expect(deps.limit).toBeInstanceOf(SupabaseCheckoutLimitStore);
    expect(calls).toEqual([
      expect.objectContaining({
        url: "https://paddle.example.test/transactions",
        headers: expect.objectContaining({ Authorization: "Bearer test-paddle-api-key" }),
        body: expect.objectContaining({
          items: [{ price_id: "pri_test_full_game", quantity: 1 }],
          checkout: { url: "https://play.example.test/pay/" },
        }),
      }),
    ]);
  });

  it("ignores a slash at the end of either address, so the pay page's path stays /pay/", async () => {
    const env = { ...ENV, PADDLE_API_BASE: `${PADDLE.apiBase}/`, APP_URL: `${PADDLE.appUrl}//` };
    const { calls } = await asked(env);
    expect(calls[0]!.url).toBe("https://paddle.example.test/transactions");
    expect(calls[0]!.body).toMatchObject({ checkout: { url: "https://play.example.test/pay/" } });
  });

  it.each(Object.keys(ENV))("has no checkout when %s is missing or empty", async (name) => {
    for (const value of [undefined, ""]) {
      const { deps } = await asked({ ...ENV, [name]: value });
      expect(deps.checkout).toBeUndefined();
    }
  });
});
