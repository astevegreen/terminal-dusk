// A fake Supabase for the entitlement tests: Auth's replies come from fakeAuth.ts, and the `entitlement` table
// answers with an empty list unless the test queued something else. Every request is recorded and none leaves.
import type { FetchLike, FetchReply } from "../../transport/remoteHttp.ts";
import { createFakeAuth } from "../../transport/test/fakeAuth.ts";
import type { AuthAnswer, AuthRequest } from "../../transport/test/fakeAuth.ts";

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(structuredClone(body)),
});

/** A row as the table would send it for an owner of the web game. */
export const WEB_ROW = { platform: "web", source: "stripe" } as const;

export function fakeEntitlements(refreshTokens: Readonly<Record<string, string>> = {}) {
  const auth = createFakeAuth(refreshTokens);
  /** Every request made, to Auth or to the table. */
  const requests: AuthRequest[] = [];
  const queued: AuthAnswer[] = [];
  let held: Promise<void> | null = null;
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, method: init?.method ?? "GET", headers: { ...init?.headers }, body: init?.body ?? null });
    if (!url.includes("/rest/v1/entitlement")) return auth.fetch(url, init);
    const answer = queued.shift() ?? { status: 200, body: [] };
    if (held) await held;
    if (answer === "throw") throw new Error("offline");
    return reply(answer.status, answer.body);
  };
  return {
    fetch,
    requests,
    auth,
    /** The requests made to the entitlement table. */
    reads: (): AuthRequest[] => requests.filter((r) => r.url.includes("/rest/v1/entitlement")),
    /** Answers the next read of the table with this. */
    answerNext(answer: AuthAnswer): void {
      queued.push(answer);
    },
    /** Holds every table reply until the returned function is called. */
    hold(): () => void {
      let release = (): void => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return release;
    },
  };
}
