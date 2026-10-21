// Test helpers for the submit handler: a match in an in-memory store, fake sign-in by token, a store that
// counts its calls, and a logger that keeps every line.
import type { HostResult } from "@terminal-dusk/host";
import type { MemoryStore, MatchStore } from "../store.ts";
import type { HttpReply, HttpRequest, SubmitHandlerDeps } from "../submitHandler.ts";
import { NOW, setup } from "./match.ts";

/** Tokens the fake sign-in knows: alice plays LIO, bob plays SAE, mallory plays neither. */
export const TOKENS: Record<string, string> = {
  "token-alice": "alice",
  "token-bob": "bob",
  "token-mallory": "mallory",
};

/** A store wrapper that counts every load and commit. */
export function counting(inner: MatchStore): { store: MatchStore; calls: () => number } {
  let calls = 0;
  return {
    store: {
      load(id) {
        calls++;
        return inner.load(id);
      },
      commit(id, seq, write) {
        calls++;
        return inner.commit(id, seq, write);
      },
    },
    calls: () => calls,
  };
}

export type HandlerWorld = {
  deps: SubmitHandlerDeps;
  memory: MemoryStore;
  start: HostResult;
  storeCalls: () => number;
  authCalls: string[];
  logged: string[];
};

/** "match-1" between alice and bob, behind a counting store, fake sign-in, a clock after NOW and a logger. */
export function handlerWorld(): HandlerWorld {
  const { store: memory, deps, start } = setup();
  const { store, calls } = counting(memory);
  const authCalls: string[] = [];
  const logged: string[] = [];
  let clock = NOW;
  return {
    deps: {
      ...deps,
      store,
      authenticate: async (token) => {
        authCalls.push(token);
        return TOKENS[token] ?? null;
      },
      now: () => ++clock,
      log: (line) => logged.push(line),
    },
    memory,
    start,
    storeCalls: calls,
    authCalls,
    logged,
  };
}

/** A POST with `token` (or no header when null) and `body`, sent as JSON unless it is already text. */
export const post = (token: string | null, body: unknown): HttpRequest => ({
  method: "POST",
  authorization: token === null ? null : `Bearer ${token}`,
  body: typeof body === "string" ? body : JSON.stringify(body),
});

/** The reply's body as JSON. */
export const json = (reply: HttpReply): unknown => JSON.parse(reply.body);
