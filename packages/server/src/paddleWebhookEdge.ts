// The wiring the `paddle-webhook` Edge Function serves with. The shared `serveFetch` keeps only the Authorization
// header, so the webhook has its own glue that reads `Paddle-Signature`. Also its settings from the environment and
// the account check. Kept here, not in the Deno entry, so it is tested.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handlePaddleWebhook } from "./paddleWebhookHandler.ts";
import type { PaddleWebhookDeps } from "./paddleWebhookHandler.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";

/** A fetch-style handler around `handlePaddleWebhook`. An unreadable body counts as an empty one (a 401). */
export function paddleWebhookFetchHandler<R>(
  deps: PaddleWebhookDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return async (request) => {
    let body = "";
    let signature: string | null = null;
    try {
      signature = request.headers.get("paddle-signature");
      body = await request.text();
    } catch {}
    const reply = await handlePaddleWebhook(deps, { method: request.method, body, signature });
    return respond(reply.body, { status: reply.status, headers: reply.headers });
  };
}

/** Whether Auth has an account with this id. It throws, rather than answer no, when Auth can't say. */
export const supabasePlayerExists =
  (db: SupabaseClient) =>
  async (id: string): Promise<boolean> => {
    const { data, error } = await db.auth.admin.getUserById(id);
    if (!error) return Boolean(data.user);
    if (error.code === "user_not_found") return false;
    throw new Error("The player could not be looked up.");
  };

/**
 * The handler's dependencies. `PADDLE_WEBHOOK_SECRET` is the secret of the webhook's destination in Paddle and
 * `PADDLE_PRODUCT_ID` the full game's product there; a variable set to "" counts as unset. `db` must be made with
 * the service role key: only the server writes entitlements.
 */
export function paddleWebhookDeps(
  env: Record<string, string | undefined>,
  db: SupabaseClient,
  log: (line: string) => void,
): PaddleWebhookDeps {
  return {
    secret: env.PADDLE_WEBHOOK_SECRET || undefined,
    productId: env.PADDLE_PRODUCT_ID || undefined,
    receipts: new SupabaseEntitlementStore(db),
    playerExists: supabasePlayerExists(db),
    log,
  };
}
