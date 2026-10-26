// The glue between the runtime's fetch-style requests and `handleAuthEmail`. The shared `serveFetch` keeps only
// the Authorization header, so the hook has its own glue that reads the three Standard Webhooks headers. Also the
// mailer the function uses when no provider is configured. Kept here, not in the Deno entry, so it is tested.
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleAuthEmail } from "./authEmailHandler.ts";
import type { AuthEmailDeps } from "./authEmailHandler.ts";
import { localMailer } from "./localMailer.ts";
import type { Mailer } from "./mailer.ts";
import { resendMailer } from "./resendMailer.ts";
import type { MailFetch } from "./resendMailer.ts";

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

export type MailerName = "local" | "resend" | "unconfigured";

/** The fixed sender used with the local mail catcher when MAIL_FROM is not set. */
export const LOCAL_TEST_SENDER = "sign-in@localhost";

/**
 * Chooses the mailer from the environment, and says which one it chose. A variable set to "" counts as unset.
 * LOCAL_MAIL_URL (local stack only) wins: Mailpit, sending from MAIL_FROM or `sign-in@localhost`. Otherwise
 * Resend when both RESEND_API_KEY and MAIL_FROM are set, else the unconfigured mailer.
 */
export function mailerFromEnv(
  env: Record<string, string | undefined>,
  fetch: MailFetch,
): { mailer: Mailer; name: MailerName } {
  const localUrl = env.LOCAL_MAIL_URL || undefined;
  const apiKey = env.RESEND_API_KEY || undefined;
  const from = env.MAIL_FROM || undefined;
  if (localUrl)
    return { mailer: localMailer({ url: localUrl, from: from ?? LOCAL_TEST_SENDER, fetch }), name: "local" };
  if (apiKey && from) return { mailer: resendMailer({ apiKey, from, fetch }), name: "resend" };
  return { mailer: unconfiguredMailer(), name: "unconfigured" };
}

/** The one startup log line: it names the mailer in use and carries no value from the environment. */
export function startupLogLine(name: MailerName): string {
  if (name === "local") return "auth-email: using the local mail catcher";
  if (name === "resend") return "auth-email: using Resend";
  return "auth-email: mail provider not configured; sign-in codes will not be sent";
}
