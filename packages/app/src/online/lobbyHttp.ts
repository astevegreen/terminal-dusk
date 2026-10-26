// The lobby client's shared part (docs/architecture.md, Decision 5): one request over an injected `fetch`
// (like transport/remoteHttp.ts), and the one rule that turns any reply into a value or a refusal code the
// screen can show. It never throws, and no result carries the server's message text or the token.
import type { FetchLike, FetchReply } from "../transport/remoteHttp.ts";

/** Where Supabase lives. Nothing here holds a URL, key or token of its own. */
export type LobbyEndpoint = { url: string; anonKey: string; fetch: FetchLike };

/** The server's own refusal codes that the lobby passes on as they are. */
export const SERVER_CODES = [
  "notSignedIn",
  "notEntitled",
  "inviteNotFound",
  "ownInvite",
  "sideRequired",
  "sideNotChoosable",
  "illegalSide",
  "invalidInvite",
] as const;

/** Why a lobby call was refused, as a code the screen can show. */
export type LobbyRefusal = (typeof SERVER_CODES)[number] | "tooManyRequests" | "network";

export type LobbyResult<T> = { ok: true; value: T } | { ok: false; error: { code: LobbyRefusal } };

export const refuse = <T>(code: LobbyRefusal): LobbyResult<T> => ({ ok: false, error: { code } });
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const KNOWN: readonly unknown[] = SERVER_CODES;

/** A reply as read: its status and body, where an unreadable body is `undefined`. Null means `fetch` threw. */
type Reply = { status: number; ok: boolean; body: unknown };

const headers = (e: LobbyEndpoint, token: string): Record<string, string> => ({
  apikey: e.anonKey,
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
});

async function send(e: LobbyEndpoint, url: string, init: Parameters<FetchLike>[1]): Promise<Reply | null> {
  let reply: FetchReply;
  try {
    reply = await e.fetch(url, init);
  } catch {
    return null;
  }
  try {
    return { status: reply.status, ok: reply.ok, body: await reply.json() };
  } catch {
    return { status: reply.status, ok: reply.ok, body: undefined };
  }
}

/** POSTs a JSON body to one Edge Function. */
export const postFunction = (e: LobbyEndpoint, token: string, fn: string, body: unknown): Promise<Reply | null> =>
  send(e, `${e.url}/functions/v1/${fn}`, {
    method: "POST",
    headers: { ...headers(e, token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** GETs one table with PostgREST query parts. */
export const getTable = (e: LobbyEndpoint, token: string, table: string, query: string[]): Promise<Reply | null> =>
  send(e, `${e.url}/rest/v1/${table}?${query.join("&")}`, { method: "GET", headers: headers(e, token) });

/**
 * Turns a reply into a result. A 2xx is read by `read` (null from it means a malformed reply, so `network`).
 * Otherwise: any 401 is `notSignedIn`; a reply with one of the server's own codes is that code; 429 is
 * `tooManyRequests`; anything else (no reply, a 5xx, an unreadable body) is `network`.
 */
export function outcome<T>(reply: Reply | null, read: (body: unknown) => T | null): LobbyResult<T> {
  if (reply === null) return refuse("network");
  if (reply.status === 401) return refuse("notSignedIn");
  if (reply.ok && reply.status >= 200 && reply.status < 300) {
    const value = read(reply.body);
    return value === null ? refuse("network") : { ok: true, value };
  }
  const body = reply.body;
  if (isObject(body) && body.ok === false && isObject(body.error) && KNOWN.includes(body.error.code)) {
    return refuse(body.error.code as LobbyRefusal);
  }
  if (reply.status === 429) return refuse("tooManyRequests");
  return refuse("network");
}
