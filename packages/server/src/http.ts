// The plain-data HTTP pieces the Edge Function handlers share (docs/architecture.md, Decision 5): the request
// and reply shapes, the CORS headers, signing a caller in from the Authorization header, and JSON replies.
import type { PlayerId } from "@terminal-dusk/host";

/** One HTTP request: its method, the `Authorization` header's value (or null) and the raw body text. */
export type HttpRequest = { method: string; authorization: string | null; body: string };
/** One HTTP reply. `body` is JSON text, or "" for the 204 answer to `OPTIONS`. */
export type HttpReply = { status: number; headers: Record<string, string>; body: string };
/** Signs a caller in: their player id for an access token, or null. */
export type Authenticate = (token: string) => Promise<PlayerId | null>;

/** Every reply carries these, so a browser app on another origin may call the functions. */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** The 204 answer to a browser's `OPTIONS` check. */
export const preflight = (): HttpReply => ({ status: 204, headers: { ...CORS_HEADERS }, body: "" });

/** The caller's player id, or null for a missing or malformed header, an empty token, or a failed sign-in. */
export async function signedIn(authenticate: Authenticate, authorization: string | null): Promise<PlayerId | null> {
  const token = typeof authorization === "string" ? /^\s*Bearer\s+(\S+)\s*$/i.exec(authorization)?.[1] : undefined;
  if (token === undefined) return null;
  try {
    const player = await authenticate(token);
    return typeof player === "string" && player.length > 0 ? player : null;
  } catch {
    return null;
  }
}

/** The body parsed as JSON when it is a plain object (not null, an array or a primitive), else null. */
export function jsonObject(text: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return isPlainObject(parsed) ? parsed : null;
}

/** A JSON reply with the CORS headers. */
export const reply = (status: number, body: unknown): HttpReply => ({
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** A refusal reply: `{ ok: false, error: { code, message } }`. */
export const refusal = (status: number, code: string, message: string): HttpReply =>
  reply(status, { ok: false, error: { code, message } });

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
