// Supabase Auth's "send email" hook (docs/architecture.md, Decision 5, "Accounts and purchases"): Auth calls the
// auth-email Edge Function with the player's address and a 6-digit code, and this handler checks the call's
// Standard Webhooks signature and sends the code through the mail port, so only a code (never a link) reaches
// the player. Plain data in and out, so it runs under vitest. Replies and log lines carry the action type and
// the outcome only: never the code, the token hash, the hook secret or the address.
import { jsonObject, preflight } from "./http.ts";
import type { HttpReply } from "./http.ts";
import { signInCodeEmail } from "./mailMessages.ts";
import type { Mailer } from "./mailer.ts";
import { signatureMatches } from "./webhookSignature.ts";

/** One hook call: the method, the raw body and the three Standard Webhooks headers (null when missing). */
export type AuthEmailRequest = {
  method: string;
  body: string;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
};

/** What the handler needs: the mailer, the hook secret (`v1,whsec_<base64>`), the clock in ms and a log. */
export type AuthEmailDeps = { mailer: Mailer; hookSecret: string; now: () => number; log: (line: string) => void };

/** How far the hook's timestamp may be from `now`: 5 minutes, in milliseconds. */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** The action types that send a sign-in code. */
const CODE_ACTIONS = new Set(["signup", "magiclink"]);

/** Handles one hook call. It never throws: anything unexpected gives a 500 in the hook's error shape. */
export async function handleAuthEmail(deps: AuthEmailDeps, request: AuthEmailRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    deps.log("auth-email: failed unexpectedly");
    return hookError(500, "The sign-in email could not be sent. Try again.");
  }
}

async function handle(deps: AuthEmailDeps, request: AuthEmailRequest): Promise<HttpReply> {
  // OPTIONS answers 204 so a local check can see the function is being served; it reveals nothing.
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") {
    deps.log("auth-email: refused, method not allowed");
    return hookError(405, "Send the hook with POST.");
  }
  const headers = { id: request.webhookId, timestamp: request.webhookTimestamp, signature: request.webhookSignature };
  if (
    !fresh(request.webhookTimestamp, deps.now()) ||
    !(await signatureMatches(deps.hookSecret, headers, request.body))
  ) {
    deps.log("auth-email: refused, bad or old signature");
    return hookError(401, "The hook signature is missing, wrong or too old.");
  }
  const payload = parsePayload(request.body);
  if (payload === null) {
    deps.log("auth-email: refused, malformed payload");
    return hookError(400, "The hook payload is not a send-email payload with a 6-digit code.");
  }
  if (!CODE_ACTIONS.has(payload.action)) {
    deps.log("auth-email: refused, unsupported action type");
    return hookError(400, "This email action type is not sent by Terminal Dusk.");
  }
  const sent = await deps.mailer.send(signInCodeEmail(payload.email, payload.token));
  if (sent.ok) {
    deps.log(`auth-email: ${payload.action} sent`);
    return { status: 200, headers: { "Content-Type": "application/json" }, body: "{}" };
  }
  deps.log(`auth-email: ${payload.action} failed (${sent.code})`);
  return sent.code === "rejected"
    ? hookError(502, "The mail provider refused the sign-in email.")
    : hookError(503, "The mail provider could not be reached. Try again.");
}

/** Whether `timestamp` is integer seconds within the tolerance of `nowMs` (milliseconds). */
function fresh(timestamp: string | null, nowMs: number): boolean {
  if (timestamp === null || !/^[0-9]{1,15}$/.test(timestamp)) return false;
  return Math.abs(nowMs - Number(timestamp) * 1000) <= TIMESTAMP_TOLERANCE_MS;
}

/** The address, code and action type in a send-email payload, or null when any is missing or the code is not 6 digits. */
function parsePayload(text: string): { email: string; token: string; action: string } | null {
  const parsed = jsonObject(text);
  const user = parsed?.user as Record<string, unknown> | undefined;
  const data = parsed?.email_data as Record<string, unknown> | undefined;
  const email = typeof user === "object" && user !== null ? user.email : undefined;
  const token = typeof data === "object" && data !== null ? data.token : undefined;
  const action = typeof data === "object" && data !== null ? data.email_action_type : undefined;
  if (typeof email !== "string" || email.length === 0 || typeof action !== "string") return null;
  if (!CODE_ACTIONS.has(action)) return { email, token: "", action };
  if (typeof token !== "string" || !/^[0-9]{6}$/.test(token)) return null;
  return { email, token, action };
}

/** The hook's error reply: `{ error: { http_code, message } }` with the same status. */
export const hookError = (status: number, message: string): HttpReply => ({
  status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ error: { http_code: status, message } }),
});
