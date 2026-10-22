// The `auth-email` Edge Function (docs/architecture.md, Decision 5, "Accounts and purchases"): Supabase Auth's
// "send email" hook calls it to send a 6-digit sign-in code. Only wiring lives here; every decision is in
// src/authEmailHandler.ts and src/authEmailEdge.ts, which are tested. SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY and
// MAIL_FROM come from the environment; none are in the repository. Without the provider key or sender, every
// signed hook call gets a 5xx and nothing is sent. Without the hook secret, no signature matches (401).
import { authEmailFetchHandler, unconfiguredMailer } from "../../../src/authEmailEdge.ts";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { resendMailer } from "../../../src/resendMailer.ts";
import type { MailFetch } from "../../../src/resendMailer.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as {
  Deno: DenoRuntime;
  Response: ResponseClass;
  fetch: MailFetch;
  console: { log(line: string): void };
};

const apiKey = runtime.Deno.env.get("RESEND_API_KEY");
const from = runtime.Deno.env.get("MAIL_FROM");
const mailer =
  apiKey && from
    ? resendMailer({ apiKey, from, fetch: (url, init) => runtime.fetch(url, init) })
    : unconfiguredMailer();
if (!apiKey || !from) runtime.console.log("auth-email: mail provider not configured; sign-in codes will not be sent");

runtime.Deno.serve(
  authEmailFetchHandler(
    {
      mailer,
      hookSecret: runtime.Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "",
      now: () => Date.now(),
      log: (line) => runtime.console.log(line),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
