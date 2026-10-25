// The `sweep-turn-alerts` Edge Function (docs/architecture.md, Decision 5, "Scheduled jobs", Notifications): the
// scheduled job calls it every minute to email each player whose turn has waited unseen for 20 minutes. Only
// wiring lives here; every decision is in src/sweepEdge.ts and src/sweepTurnAlerts.ts, which are tested. A call
// must present the service role key. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL, RESEND_API_KEY and
// MAIL_FROM come from the environment; none are in the repository. Without the provider key or sender, the mailer
// is the unconfigured one, so every unsent alert comes back `failed` and stays due.
// It does not log (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import { unconfiguredMailer } from "../../../src/authEmailEdge.ts";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { resendMailer } from "../../../src/resendMailer.ts";
import type { MailFetch } from "../../../src/resendMailer.ts";
import { supabaseEmailOf } from "../../../src/supabaseEmailOf.ts";
import { SupabaseNotifyStore } from "../../../src/supabaseNotifyStore.ts";
import { SupabaseStore } from "../../../src/supabaseStore.ts";
import { sweepTurnAlertsFetchHandler } from "../../../src/sweepEdge.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as { Deno: DenoRuntime; Response: ResponseClass; fetch: MailFetch };

const required = (name: string): string => {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(required("SUPABASE_URL"), serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const appUrl = required("APP_URL");

const apiKey = runtime.Deno.env.get("RESEND_API_KEY");
const from = runtime.Deno.env.get("MAIL_FROM");
const mailer =
  apiKey && from
    ? resendMailer({ apiKey, from, fetch: (url, init) => runtime.fetch(url, init) })
    : unconfiguredMailer();

const store = new SupabaseStore(db);
runtime.Deno.serve(
  sweepTurnAlertsFetchHandler(
    {
      alerts: { notify: new SupabaseNotifyStore(db), store, mailer, emailOf: supabaseEmailOf(db), appUrl },
      serviceKey,
      now: () => Date.now(),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
