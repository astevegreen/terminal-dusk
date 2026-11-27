// The `paddle-webhook` Edge Function (docs/architecture.md, Decision 5, "Accounts and purchases"): Paddle calls it
// when a web order is paid or refunded, and it writes or removes the buyer's `web` entitlement. Only wiring lives
// here; every decision is in src/paddleWebhookHandler.ts and src/paddleWebhookEdge.ts, which are tested. The
// Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; PADDLE_WEBHOOK_SECRET and
// PADDLE_PRODUCT_ID are set as function secrets. None are in the repository. Without the webhook secret no
// signature matches (401); without the product id a paid message gets a 500, so Paddle sends it again.
import { createClient } from "@supabase/supabase-js";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { paddleWebhookDeps, paddleWebhookFetchHandler } from "../../../src/paddleWebhookEdge.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as {
  Deno: DenoRuntime;
  Response: ResponseClass;
  console: { log(line: string): void };
};

const { env } = runtime.Deno;
const required = (name: string): string => {
  const value = env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

runtime.Deno.serve(
  paddleWebhookFetchHandler(
    paddleWebhookDeps(
      { PADDLE_WEBHOOK_SECRET: env.get("PADDLE_WEBHOOK_SECRET"), PADDLE_PRODUCT_ID: env.get("PADDLE_PRODUCT_ID") },
      db,
      (line) => runtime.console.log(line),
    ),
    (body, init) => new runtime.Response(body, init),
  ),
);
