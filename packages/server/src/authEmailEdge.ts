// The glue between the runtime's fetch-style requests and `handleAuthEmail`. The shared `serveFetch` keeps only
// the Authorization header, so the hook has its own glue that reads the three Standard Webhooks headers. Also the
// mailer the function uses when no provider is configured. Kept here, not in the Deno entry, so it is tested.
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleAuthEmail } from "./authEmailHandler.ts";
import type { AuthEmailDeps } from "./authEmailHandler.ts";
import type { Mailer } from "./mailer.ts";

/** A fetch-style handler around `handleAuthEmail`. An unreadable body counts as an empty one. */
export function authEmailFetchHandler<R>(
  deps: AuthEmailDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return async (request) => {
    let body = "";
    let webhookId: string | null = null;
    let webhookTimestamp: string | null = null;
    let webhookSignature: string | null = null;
    try {
      webhookId = request.headers.get("webhook-id");
      webhookTimestamp = request.headers.get("webhook-timestamp");
      webhookSignature = request.headers.get("webhook-signature");
      body = await request.text();
    } catch {}
    const reply = await handleAuthEmail(deps, {
      method: request.method,
      body,
      webhookId,
      webhookTimestamp,
      webhookSignature,
    });
    return respond(reply.status === 204 ? null : reply.body, { status: reply.status, headers: reply.headers });
  };
}

/**
 * The mailer used when the provider key or sender is not set: every send answers `unavailable` and nothing is
 * sent, so every signed hook call gets a 5xx and Auth tells the player the code was not sent. The signature is
 * still checked first, so an unsigned call still gets 401.
 */
export const unconfiguredMailer = (): Mailer => ({
  send: () => Promise.resolve({ ok: false, code: "unavailable" }),
});
