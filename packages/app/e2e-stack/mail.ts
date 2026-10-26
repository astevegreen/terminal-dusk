// Reading sign-in codes from the local stack's mail catcher (Mailpit) for A10. The catcher's address comes from
// MAILPIT_URL (or INBUCKET_URL), the names `supabase status -o env` prints, and is the Supabase CLI's local
// default, http://127.0.0.1:54324, when neither is set. A code is never logged or kept: it is read, typed and dropped.
import type { StackKeys } from "../src/transport/test/localStack.ts";

type Env = Record<string, string | undefined>;

/** The mail catcher's address, with no trailing slash. */
export function mailpitUrl(env: Env): string {
  let url = env.MAILPIT_URL || env.INBUCKET_URL || "http://127.0.0.1:54324";
  while (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

/** The 6-digit code in a message's text, ignoring the address (which may hold digits), or null when there is none. */
export function codeFrom(text: string, address: string): string | null {
  return /\b\d{6}\b/.exec(text.split(address).join(""))?.[0] ?? null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The messages sent to `address` (Mailpit's ids). */
async function idsFor(mail: string, address: string): Promise<string[]> {
  const query = encodeURIComponent("to:" + address);
  const reply = await fetch(`${mail}/api/v1/search?query=${query}`);
  const found = (await reply.json()) as { messages?: { ID: string }[] };
  return (found.messages ?? []).map((m) => m.ID);
}

/** Waits for the newest message to `address` and returns its code, then deletes that address's messages. */
export async function waitForCode(mail: string, address: string, waitMs: number): Promise<string> {
  for (let waited = 0; waited <= waitMs; waited += 250) {
    const ids = await idsFor(mail, address);
    const newest = ids[0];
    if (newest !== undefined) {
      const message = (await (await fetch(`${mail}/api/v1/message/${newest}`)).json()) as { Text?: string };
      const code = codeFrom(message.Text ?? "", address);
      if (code !== null) {
        // Only this address's own messages: with no body Mailpit would delete everything in the inbox.
        await fetch(`${mail}/api/v1/messages`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: ids }),
        });
        return code;
      }
    }
    await sleep(250);
  }
  throw new Error(`no sign-in code reached the mail catcher at ${mail} within ${waitMs / 1000} s`);
}

/** Why sign-in codes can't be read, or null: the auth-email function answers and so does the mail catcher. */
export async function whyMailUnavailable(keys: StackKeys, mail: string, howToStart: string): Promise<string | null> {
  try {
    const reply = await fetch(`${keys.url}/functions/v1/auth-email`, {
      method: "OPTIONS",
      headers: { apikey: keys.anonKey },
    });
    if (reply.status !== 204) {
      return `the auth-email Edge Function did not answer OPTIONS with 204 (status ${reply.status}). ${howToStart}`;
    }
  } catch {
    return `the auth-email Edge Function did not answer (is \`supabase functions serve\` running?). ${howToStart}`;
  }
  try {
    const reply = await fetch(`${mail}/api/v1/info`);
    return reply.status === 200 ? null : `the mail catcher at ${mail} answered ${reply.status}. ${howToStart}`;
  } catch {
    return `the mail catcher at ${mail} did not answer. ${howToStart}`;
  }
}
