// Email sign-in codes (docs/architecture.md, Decisions 5 and 7): asks Supabase Auth to email a 6-digit
// code, trades the code for a session and refreshes that session, over an injected `fetch` like
// remoteHttp.ts. Nothing here stores the session or reads the clock: the caller passes `now` and keeps the
// session in Platform storage. No result carries the code, a failed call's tokens or Auth's raw text.
import type { FetchLike, FetchReply } from "./remoteHttp.ts";

/** Where Supabase Auth lives. */
export type AuthEndpoint = { url: string; anonKey: string; fetch: FetchLike };

/** A signed-in session. `expiresAt` is in milliseconds, on the caller's clock. */
export type Session = { accessToken: string; refreshToken: string; expiresAt: number; userId: string };

/** Why a call was refused, as a code the UI can show. */
export type AuthRefusal = "badEmail" | "badCode" | "wrongCode" | "tooManyRequests" | "network";

export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: { code: AuthRefusal } };

/** Time left on the access token below which `sessionToken` refreshes it. */
export const REFRESH_MARGIN_MS = 60_000;

const refuse = <T>(code: AuthRefusal): AuthResult<T> => ({ ok: false, error: { code } });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const goodEmail = (email: string): boolean => email.split("@").length === 2 && !/\s/.test(email);
const goodCode = (code: string): boolean => /^[0-9]{6}$/.test(code);

/** POSTs a JSON body to Auth. Null means no usable reply: a thrown fetch or an unreadable body. */
async function post(e: AuthEndpoint, path: string, body: unknown): Promise<{ status: number; body: unknown } | null> {
  let reply: FetchReply;
  try {
    reply = await e.fetch(`${e.url}${path}`, {
      method: "POST",
      headers: { apikey: e.anonKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
  try {
    return { status: reply.status, body: await reply.json() };
  } catch {
    return reply.ok ? null : { status: reply.status, body: null };
  }
}

/** The refusal for a failed status: `refused` is what a 4xx other than 429 means for this call. */
const failure = (status: number, refused: AuthRefusal): AuthRefusal => {
  if (status === 429) return "tooManyRequests";
  if (status >= 400 && status < 500) return refused;
  return "network";
};

/** Reads a session reply; a reply missing any part counts as no usable reply. */
function toSession(body: unknown, now: number): AuthResult<Session> {
  if (!isObject(body) || !isObject(body.user)) return refuse("network");
  const { access_token, refresh_token, expires_in } = body;
  const userId = body.user.id;
  if (typeof access_token !== "string" || access_token === "") return refuse("network");
  if (typeof refresh_token !== "string" || refresh_token === "") return refuse("network");
  if (typeof userId !== "string" || userId === "") return refuse("network");
  if (typeof expires_in !== "number" || !Number.isInteger(expires_in) || expires_in <= 0) return refuse("network");
  const expiresAt = now + expires_in * 1000;
  if (!Number.isSafeInteger(expiresAt)) return refuse("network");
  return { ok: true, value: { accessToken: access_token, refreshToken: refresh_token, expiresAt, userId } };
}

/** Asks Auth to email a sign-in code (never a link). Never throws. */
export async function requestCode(e: AuthEndpoint, email: string): Promise<AuthResult<null>> {
  if (!goodEmail(email)) return refuse("badEmail");
  const reply = await post(e, "/auth/v1/otp", { email, create_user: true });
  if (reply === null) return refuse("network");
  if (reply.status >= 200 && reply.status < 300) return { ok: true, value: null };
  return refuse(failure(reply.status, "badEmail"));
}

/** Trades an emailed code for a session. Never throws. */
export async function verifyCode(
  e: AuthEndpoint,
  email: string,
  code: string,
  now: number,
): Promise<AuthResult<Session>> {
  if (!goodEmail(email)) return refuse("badEmail");
  if (!goodCode(code)) return refuse("badCode");
  const reply = await post(e, "/auth/v1/verify", { type: "email", email, token: code });
  if (reply === null) return refuse("network");
  if (reply.status >= 200 && reply.status < 300) return toSession(reply.body, now);
  return refuse(failure(reply.status, "wrongCode"));
}

/** Trades a refresh token for a new session. A refused refresh token comes back as wrongCode. Never throws. */
export async function refreshSession(e: AuthEndpoint, refreshToken: string, now: number): Promise<AuthResult<Session>> {
  const reply = await post(e, "/auth/v1/token?grant_type=refresh_token", { refresh_token: refreshToken });
  if (reply === null) return refuse("network");
  if (reply.status >= 200 && reply.status < 300) return toSession(reply.body, now);
  return refuse(failure(reply.status, "wrongCode"));
}

/**
 * A `RemoteMatchOptions.accessToken` for a session: the stored token while it has more than a minute
 * left, else one shared refresh whose new session goes to `save`. A failed refresh resolves null (signed
 * out) without calling `save`; the next call tries again. It never throws.
 */
export function sessionToken(
  e: AuthEndpoint,
  session: Session,
  now: () => number,
  save: (session: Session) => void,
): () => Promise<string | null> {
  let current = session;
  let refreshing: Promise<string | null> | null = null;

  const refresh = async (): Promise<string | null> => {
    const result = await refreshSession(e, current.refreshToken, now());
    if (!result.ok) return null;
    current = result.value;
    try {
      save(result.value);
    } catch {
      // The new session still works for this run; storing it is the caller's job.
    }
    return current.accessToken;
  };

  return () => {
    if (current.expiresAt - now() > REFRESH_MARGIN_MS) return Promise.resolve(current.accessToken);
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };
}
