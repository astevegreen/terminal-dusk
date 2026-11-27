// The wiring the `paddle-webhook` Edge Function serves with: the fetch glue that carries the Paddle-Signature
// header, the settings read from the environment, and the account check. The Deno entry only calls these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { paddleWebhookDeps, paddleWebhookFetchHandler, supabasePlayerExists } from "./paddleWebhookEdge.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { paid, PLAYER, PRODUCT, SECRET, signed } from "./test/paddle.ts";

const respond = (body: string | null, init: { status: number; headers: Record<string, string> }) => ({ body, ...init });
const db = {} as unknown as SupabaseClient;

describe("paddleWebhookFetchHandler", () => {
  const store = new MemoryEntitlementStore();
  const handle = paddleWebhookFetchHandler(
    { secret: SECRET, productId: PRODUCT, receipts: store, playerExists: async () => true, log: () => {} },
    respond,
  );

  it("reads the Paddle-Signature header and the raw body", async () => {
    const request = await signed(paid());
    const reply = await handle({
      method: "POST",
      headers: { get: (name) => (name === "paddle-signature" ? request.signature : null) },
      text: async () => request.body,
    });
    expect(reply.status).toBe(200);
    expect(await store.forPlayer(PLAYER)).toEqual([{ platform: "web", source: "paddle" }]);
  });

  it("answers 401 to a request whose body can't be read", async () => {
    const reply = await handle({
      method: "POST",
      headers: { get: () => "ts=1;h1=00" },
      text: () => Promise.reject(new Error("stream broke")),
    });
    expect(reply.status).toBe(401);
  });
});

describe("paddleWebhookDeps", () => {
  it("takes the secret and product from the environment and writes through the Supabase store", () => {
    const deps = paddleWebhookDeps({ PADDLE_WEBHOOK_SECRET: SECRET, PADDLE_PRODUCT_ID: PRODUCT }, db, () => {});
    expect([deps.secret, deps.productId]).toEqual([SECRET, PRODUCT]);
    expect(deps.receipts).toBeInstanceOf(SupabaseEntitlementStore);
  });

  it("counts a missing or empty setting as unset", () => {
    for (const env of [{}, { PADDLE_WEBHOOK_SECRET: "", PADDLE_PRODUCT_ID: "" }]) {
      const deps = paddleWebhookDeps(env, db, () => {});
      expect([deps.secret, deps.productId]).toEqual([undefined, undefined]);
    }
  });
});

describe("supabasePlayerExists", () => {
  type Answer = { data: { user: object | null }; error: { code?: string; status?: number } | null };
  const asking = (answer: Answer) => {
    const asked: string[] = [];
    const client = {
      auth: { admin: { getUserById: async (id: string) => (asked.push(id), answer) } },
    } as unknown as SupabaseClient;
    return { asked, exists: () => supabasePlayerExists(client)(PLAYER) };
  };

  it("is true for an account Auth knows", async () => {
    const { asked, exists } = asking({ data: { user: { id: PLAYER } }, error: null });
    expect(await exists()).toBe(true);
    expect(asked).toEqual([PLAYER]);
  });

  it("is false when Auth says there is no such user", async () => {
    const { exists } = asking({ data: { user: null }, error: { code: "user_not_found", status: 404 } });
    expect(await exists()).toBe(false);
  });

  it.each([
    ["Auth is failing", { status: 500 }],
    ["the key is refused", { code: "not_admin", status: 403 }],
    ["an unexplained 404, such as a wrong address", { status: 404 }],
    ["the network is down", { status: 0 }],
  ])("throws, rather than call the player unknown, when %s", async (_name, error) => {
    const { exists } = asking({ data: { user: null }, error });
    await expect(exists()).rejects.toThrow("The player could not be looked up.");
  });
});
