// A fake Supabase Auth for the email-code client's tests: a fake `fetch` that records every request and
// answers with whatever the test queued, or a stock success reply for the path when nothing is queued.
import type { FetchLike, FetchReply } from "../remoteHttp.ts";

export const AUTH_URL = "https://fake.supabase.test";
export const AUTH_ANON_KEY = "fake-anon-key";

/** One request as the fake saw it. */
export type AuthRequest = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A queued answer: a status and body, or a thrown error like a dropped connection. */
export type AuthAnswer = { status: number; body: unknown } | "throw";

/** A Supabase Auth session reply, as `/verify` and the refresh grant send it. */
export const sessionBody = (access: string, refresh: string, expiresIn = 3600): Record<string, unknown> => ({
  access_token: access,
  token_type: "bearer",
  expires_in: expiresIn,
  refresh_token: refresh,
  user: { id: "user-1", email: "ana@example.com" },
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

export function createFakeAuth(): FakeAuth {
  const requests: AuthRequest[] = [];
  const queued: AuthAnswer[] = [];
  let gate: Promise<void> | null = null;
  let refreshes = 0;

  const stock = (url: string): AuthAnswer => {
    if (url.includes("/auth/v1/otp")) return { status: 200, body: {} };
    if (url.includes("/auth/v1/verify")) return { status: 200, body: sessionBody("access-1", "refresh-1") };
    refreshes++;
    return { status: 200, body: sessionBody(`access-r${refreshes}`, `refresh-r${refreshes}`) };
  };

  const fetch: FetchLike = async (url, init) => {
    requests.push({
      url,
      method: init.method,
      headers: { ...init.headers },
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    });
    const answer = queued.shift() ?? stock(url);
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
