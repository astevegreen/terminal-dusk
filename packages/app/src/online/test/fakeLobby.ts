// A fake server for the lobby client's tests: a fake `fetch` that records every request and answers with
// whatever the test queued, like transport/test/fakeAuth.ts. Nothing queued answers 500.
import type { FetchLike, FetchReply } from "../../transport/remoteHttp.ts";
import type { LobbyEndpoint } from "../lobbyHttp.ts";

export const LOBBY_URL = "https://fake.supabase.test";
export const LOBBY_ANON_KEY = "fake-anon-key";
export const TOKEN = "token-abc";
export const PLAYER = "11111111-2222-4333-8444-555555555555";
export const OTHER = "99999999-8888-4777-8666-555555555555";

/** One request as the fake saw it; `body` is the parsed JSON, or undefined for a GET. */
export type LobbyRequest = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A queued answer: a status and body, a body that cannot be read, or a thrown error. */
export type LobbyAnswer = { status: number; body: unknown } | { status: number; unreadable: true } | "throw";

export type FakeLobby = { endpoint: LobbyEndpoint; requests: LobbyRequest[]; answerNext(answer: LobbyAnswer): void };

const reply = (answer: Exclude<LobbyAnswer, "throw">): FetchReply => ({
  ok: answer.status >= 200 && answer.status < 300,
  status: answer.status,
  json: () =>
    "unreadable" in answer
      ? Promise.reject(new SyntaxError("Unexpected token <"))
      : Promise.resolve(JSON.parse(JSON.stringify(answer.body)) as unknown),
});

export function createFakeLobby(): FakeLobby {
  const requests: LobbyRequest[] = [];
  const queued: LobbyAnswer[] = [];
  const fetch: FetchLike = (url, init) => {
    requests.push({
      url,
      method: init.method,
      headers: { ...init.headers },
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    });
    const answer = queued.shift() ?? { status: 500, body: { ok: false, error: { code: "internalError" } } };
    if (answer === "throw") return Promise.reject(new Error("connection reset"));
    return Promise.resolve(reply(answer));
  };
  return {
    endpoint: { url: LOBBY_URL, anonKey: LOBBY_ANON_KEY, fetch },
    requests,
    answerNext: (answer) => {
      queued.push(answer);
    },
  };
}

/** A refusal body as the invite function sends it, message text included. */
export const refusalBody = (code: string): Record<string, unknown> => ({
  ok: false,
  error: { code, message: `Server says ${code} for ${TOKEN}` },
});
