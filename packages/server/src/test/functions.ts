// Test helpers for calling an Edge Function served by the local Supabase stack (`supabase functions serve`).
// The server's tsconfig has no DOM types, so fetch is reached through a typed globalThis.
import type { StackKeys } from "../migrations/localStack.ts";

type FetchReply = { status: number; text(): Promise<string> };
type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchReply>;
const fetchFn: Fetch = (globalThis as unknown as { fetch: Fetch }).fetch;

export const SERVE_HINT =
  "Serve the functions too: in packages/server run `pnpm exec supabase functions serve` in a second terminal.";

/** One call to the function `name`: its status and its body parsed as JSON (null when empty or not JSON). */
export async function callFunction(
  keys: StackKeys,
  name: string,
  call: { method: string; token?: string | null; body?: unknown },
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { apikey: keys.anonKey, "content-type": "application/json" };
  if (call.token) headers.authorization = `Bearer ${call.token}`;
  const init =
    call.body === undefined
      ? { method: call.method, headers }
      : { method: call.method, headers, body: JSON.stringify(call.body) };
  const reply = await fetchFn(`${keys.url}/functions/v1/${name}`, init);
  const text = await reply.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: reply.status, json };
}

/**
 * Why the function `name` can't be used, or null when it answers `probe.method` with `probe.status`: by default
 * OPTIONS with 204. A function that takes only POST (the sweeps) is probed with GET, which it answers with 405.
 */
export async function whyFunctionUnavailable(
  keys: StackKeys,
  name: string,
  probe: { method: string; status: number } = { method: "OPTIONS", status: 204 },
): Promise<string | null> {
  const down = `the ${name} Edge Function did not answer ${probe.method} with ${probe.status}. ${SERVE_HINT}`;
  try {
    const { status } = await callFunction(keys, name, { method: probe.method, token: keys.anonKey });
    return status === probe.status ? null : `${down} (status ${status})`;
  } catch {
    return down;
  }
}
