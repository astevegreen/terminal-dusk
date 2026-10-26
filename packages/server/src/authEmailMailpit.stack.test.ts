// A sign-in code reaches the local stack's mail catcher (Mailpit): a correctly signed `magiclink` hook call to the
// served auth-email function answers 200, and the catcher then holds one message with a 6-digit code for that
// test's own unique address. Needs the stack, the served function (with LOCAL_MAIL_URL and the same hook secret in
// supabase/functions/.env) and SEND_EMAIL_HOOK_SECRET in this test's environment; otherwise it says how to start.
import { expect, it } from "vitest";
import { freshId, HOW_TO_START } from "./migrations/localStack.ts";
import type { StackKeys } from "./migrations/localStack.ts";
import { payload, signedRequest } from "./test/authEmail.ts";
import { whyFunctionUnavailable } from "./test/functions.ts";
import { onLocalStack } from "./test/stack.ts";

type Reply = { status: number; text(): Promise<string> };
type Init = { method: string; headers?: Record<string, string>; body?: string };
const fetchFn = (globalThis as unknown as { fetch: (url: string, init?: Init) => Promise<Reply> }).fetch;
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const hookSecret = env.SEND_EMAIL_HOOK_SECRET || undefined;
// The test runs on the host, so it reaches Mailpit at the stack's own host, never through host.docker.internal.
const mailpitUrl = (keys: StackKeys): string => {
  const set = env.MAILPIT_URL || env.INBUCKET_URL;
  if (set) return set.replace(/\/+$/, "");
  const host = /^https?:\/\/([^/:]+)/.exec(keys.url)?.[1] ?? "127.0.0.1";
  return `http://${host}:54324`;
};

async function why(keys: StackKeys): Promise<string | null> {
  if (!hookSecret) return `SEND_EMAIL_HOOK_SECRET is not set in the test's environment. ${HOW_TO_START}`;
  const functionProblem = await whyFunctionUnavailable(keys, "auth-email");
  if (functionProblem) return functionProblem;
  try {
    const reply = await fetchFn(`${mailpitUrl(keys)}/api/v1/info`, { method: "GET" });
    return reply.status === 200 ? null : `the mail catcher (Mailpit) answered ${reply.status}. ${HOW_TO_START}`;
  } catch {
    return `the mail catcher (Mailpit) at ${mailpitUrl(keys)} did not answer. ${HOW_TO_START}`;
  }
}

await onLocalStack(
  "the auth-email Edge Function sending to the local mail catcher",
  (keys: StackKeys) => {
    it("a signed magiclink hook call answers 200 and the catcher holds one message with a 6-digit code", async () => {
      const mailpit = mailpitUrl(keys);
      const address = `mailpit-${freshId()}@terminal-dusk.test`;
      const base = JSON.parse(payload("magiclink")) as { user: { email: string } };
      base.user.email = address;
      const body = JSON.stringify(base);
      const signed = await signedRequest(body, {
        secret: hookSecret!,
        timestamp: String(Math.floor(Date.now() / 1000)),
        id: `msg_${freshId()}`,
      });
      const ids: string[] = [];
      try {
        const reply = await fetchFn(`${keys.url}/functions/v1/auth-email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: keys.anonKey,
            "webhook-id": signed.webhookId!,
            "webhook-timestamp": signed.webhookTimestamp!,
            "webhook-signature": signed.webhookSignature!,
          },
          body,
        });
        expect(reply.status).toBe(200);

        const search = await fetchFn(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`, {
          method: "GET",
        });
        const found = JSON.parse(await search.text()) as { messages: { ID: string }[] };
        ids.push(...found.messages.map((m) => m.ID));
        expect(ids).toHaveLength(1);

        const full = await fetchFn(`${mailpit}/api/v1/message/${ids[0]}`, { method: "GET" });
        const message = JSON.parse(await full.text()) as { Text: string };
        expect(message.Text).toMatch(/\b\d{6}\b/);
      } finally {
        if (ids.length > 0) {
          // Only this test's own message: with no body Mailpit would delete everything in the inbox.
          await fetchFn(`${mailpit}/api/v1/messages`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ IDs: ids }),
          });
        }
      }
    });
  },
  why,
);
