// A fake Supabase Auth for the email-code client's tests: a fake `fetch` that records every request and
// answers with whatever the test queued, or a stock reply for the path when nothing is queued. Like Auth, a refresh
// keeps the user its refresh token belongs to, and refuses a refresh token it never issued or was told of.
import type { FetchLike, FetchReply } from "../remoteHttp.ts";

export const AUTH_URL = "https://fake.supabase.test";
export const AUTH_ANON_KEY = "fake-anon-key";

/** One request as the fake saw it. */
export type AuthRequest = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A queued answer: a status and body, or a thrown error like a dropped connection. */
export type AuthAnswer = { status: number; body: unknown } | "throw";

/** A Supabase Auth session reply, as `/verify` and the refresh grant send it. */
export const sessionBody = (
  access: string,
  refresh: string,
  expiresIn = 3600,
  userId = "user-1",
): Record<string, unknown> => ({
  access_token: access,
  token_type: "bearer",
  expires_in: expiresIn,
  refresh_token: refresh,
  user: { id: userId, email: "ana@example.com" },
});

export type FakeAuth = {
  fetch: FetchLike;
  requests: AuthRequest[];
  /** Answers the next request with this, instead of the stock reply. */
  answerNext(answer: AuthAnswer): void;
  /** Holds every reply until the returned function is called. */
  hold(): () => void;
};

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(JSON.parse(JSON.stringify(body)) as unknown),
});

/**
 * `refreshTokens` names the user of each refresh token issued before the test (a stored session's, say); `/verify`'s
 * refresh-1 is user-1's.
 */
export function createFakeAuth(refreshTokens: Readonly<Record<string, string>> = {}): FakeAuth {
  const requests: AuthRequest[] = [];
  const userOf = new Map<string, string>([["refresh-1", "user-1"], ...Object.entries(refreshTokens)]);
  const queued: AuthAnswer[] = [];
  let gate: Promise<void> | null = null;
  let refreshes = 0;

  const stock = (url: string, body: unknown): AuthAnswer => {
    if (url.includes("/auth/v1/otp")) return { status: 200, body: {} };
    if (url.includes("/auth/v1/verify")) return { status: 200, body: sessionBody("access-1", "refresh-1") };
    const token = (body as { refresh_token?: unknown } | undefined)?.refresh_token;
    const userId = typeof token === "string" ? userOf.get(token) : undefined;
    if (userId === undefined) return { status: 400, body: { msg: "Invalid Refresh Token" } };
    refreshes++;
    userOf.set(`refresh-r${refreshes}`, userId);
    return { status: 200, body: sessionBody(`access-r${refreshes}`, `refresh-r${refreshes}`, 3600, userId) };
  };

  const fetch: FetchLike = async (url, init) => {
    const body: unknown = init.body === undefined ? undefined : JSON.parse(init.body);
    requests.push({ url, method: init.method, headers: { ...init.headers }, body });
    const answer = queued.shift() ?? stock(url, body);
    if (gate !== null) await gate;
    if (answer === "throw") throw new Error("connection reset");
    return reply(answer.status, answer.body);
  };

  return {
    fetch,
    requests,
    answerNext: (answer) => {
      queued.push(answer);
    },
    hold: () => {
      let release = (): void => {};
      gate = new Promise<void>((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return release;
    },
  };
}
