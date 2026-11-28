// The `checkout` Edge Function (Deno): gives the signed-in player the address of a Paddle checkout.
// This file is only wiring: all logic lives in packages/server/src and is tested there.
import { createClient } from "@supabase/supabase-js";
import { checkoutDeps, checkoutFetchHandler } from "../../../src/checkoutEdge.ts";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import type { CheckoutFetch } from "../../../src/paddleCheckout.ts";

type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): void;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as {
  Deno: DenoRuntime;
  Response: ResponseClass;
  fetch: CheckoutFetch;
  console: { log(line: string): void };
};

function required(name: string): string {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
// PADDLE_* are function secrets and APP_URL the web app's address (#717 sets them). Without all four the function
// starts and answers 503.
const env = Object.fromEntries(
  ["PADDLE_API_BASE", "PADDLE_API_KEY", "PADDLE_PRICE_ID", "APP_URL"].map((name) => [name, runtime.Deno.env.get(name)]),
);
const deps = checkoutDeps(env, db, {
  fetch: (url, init) => runtime.fetch(url, init),
  log: (line) => runtime.console.log(line),
  now: () => Date.now(),
});

runtime.Deno.serve(checkoutFetchHandler(deps, (body, init) => new runtime.Response(body, init)));
