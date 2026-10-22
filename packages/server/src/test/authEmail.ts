// Test helpers for the auth-email hook: a test secret, a send-email payload, a correctly signed hook request
// and a handler wired to a MemoryMailer and a recorded log.
import type { AuthEmailDeps, AuthEmailRequest } from "../authEmailHandler.ts";
import { MemoryMailer } from "../mailer.ts";
import { secretKey, sign } from "../webhookSignature.ts";

/** A throwaway test secret in Supabase's `v1,whsec_<base64>` form (the key is "terminal-dusk-test-hook-key!"). */
export const TEST_SECRET = "v1,whsec_dGVybWluYWwtZHVzay10ZXN0LWhvb2sta2V5IQ==";
export const TEST_CODE = "482913";
export const TEST_TOKEN_HASH = "f3a9c1e7b2d84f6a9e0c5b7d1a2f3e4c5b6a7d8e9f0a1b2c3d4e5f6a";
export const TEST_EMAIL = "player.one@terminal-dusk.test";
/** The clock in tests, in milliseconds; the matching webhook timestamp is in seconds. */
export const NOW_MS = 1_790_000_000_000;
export const NOW_SECONDS = String(NOW_MS / 1000);

/** A send-email payload in Supabase's shape for `action`. */
export const payload = (action: string): string =>
  JSON.stringify({
    user: { id: "user-1", email: TEST_EMAIL, aud: "authenticated" },
    email_data: {
      token: TEST_CODE,
      token_hash: TEST_TOKEN_HASH,
      redirect_to: "",
      email_action_type: action,
      site_url: "http://127.0.0.1:3000",
      token_new: "",
      token_hash_new: "",
    },
  });

/** A POST of `body` signed with `secret` at `timestamp` (seconds). */
export async function signedRequest(
  body: string,
  options: { secret?: string; timestamp?: string; id?: string } = {},
): Promise<AuthEmailRequest> {
  const id = options.id ?? "msg_2Kx9test";
  const timestamp = options.timestamp ?? NOW_SECONDS;
  const key = secretKey(options.secret ?? TEST_SECRET);
  if (key === null) throw new Error("bad test secret");
  const signature = `v1,${await sign(key, id, timestamp, body)}`;
  return { method: "POST", body, webhookId: id, webhookTimestamp: timestamp, webhookSignature: signature };
}

/** A handler's deps around a MemoryMailer, with every log line kept. */
export function authEmailWorld(): { deps: AuthEmailDeps; mailer: MemoryMailer; logs: string[] } {
  const mailer = new MemoryMailer();
  const logs: string[] = [];
  return { deps: { mailer, hookSecret: TEST_SECRET, now: () => NOW_MS, log: (line) => logs.push(line) }, mailer, logs };
}
