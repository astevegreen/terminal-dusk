// The wiring the `checkout` Edge Function entry uses: fetch glue around handleCheckout and the settings read from
// the environment. A missing or empty setting leaves the checkout off, and the function answers 503.
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleCheckout } from "./checkoutHandler.ts";
import type { CheckoutHandlerDeps } from "./checkoutHandler.ts";
import { serveFetch, supabaseAuthenticate } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { paddleCheckout } from "./paddleCheckout.ts";
import type { CheckoutFetch, PaddleSettings } from "./paddleCheckout.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";

/** The function's whole behaviour as a fetch handler. */
export function checkoutFetchHandler<R>(
  deps: CheckoutHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleCheckout(deps, request), respond);
}

export function checkoutDeps(
  env: Record<string, string | undefined>,
  db: SupabaseClient,
  runtime: { fetch: CheckoutFetch; log: (line: string) => void },
): CheckoutHandlerDeps {
  const settings = paddleSettings(env);
  return {
    authenticate: supabaseAuthenticate(db),
    entitlements: new SupabaseEntitlementStore(db),
    checkout: settings && paddleCheckout(settings, runtime.fetch),
    log: runtime.log,
  };
}

/** Paddle's settings and the app's address, or undefined when any of them is unset. */
function paddleSettings(env: Record<string, string | undefined>): PaddleSettings | undefined {
  const apiBase = withoutEndSlashes(env.PADDLE_API_BASE ?? "");
  const apiKey = env.PADDLE_API_KEY;
  const priceId = env.PADDLE_PRICE_ID;
  const productId = env.PADDLE_PRODUCT_ID;
  const appUrl = withoutEndSlashes(env.APP_URL ?? "");
  return apiBase && apiKey && priceId && productId && appUrl
    ? { apiBase, apiKey, priceId, productId, appUrl }
    : undefined;
}

function withoutEndSlashes(address: string): string {
  let end = address.length;
  while (address[end - 1] === "/") end -= 1;
  return address.slice(0, end);
}
