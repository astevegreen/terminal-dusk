// Test helpers for the seen handler: "match-1" at seq 0 with its first turn alerts queued (alerts.ts), behind
// a match store and a notify store that record every call, fake sign-in by token and a logger that keeps
// every line.
import type { HostResult, PlayerId } from "@terminal-dusk/host";
import type { MemoryNotifyStore, NotifyStore } from "../notifyStore.ts";
import type { SeenHandlerDeps } from "../seenHandler.ts";
import type { MatchStore, MemoryStore } from "../store.ts";
import { alertWorld } from "./alerts.ts";
import { TOKENS } from "./handler.ts";

/** Each player's token for the fake sign-in. */
export const TOKEN_OF: Record<string, string> = { alice: "token-alice", bob: "token-bob" };

/** A match store wrapper that records the name of every call. */
export function recordingStore(inner: MatchStore, calls: string[]): MatchStore {
  return {
    load(id) {
      calls.push("load");
      return inner.load(id);
    },
    commit(id, seq, write) {
      calls.push("commit");
      return inner.commit(id, seq, write);
    },
  };
}

/** A notify store wrapper that records every call, with `seen`'s and `keep`'s arguments. */
export function recordingNotify(inner: NotifyStore, calls: string[]): NotifyStore {
  return {
    queue(alerts) {
      calls.push("queue");
      return inner.queue(alerts);
    },
    seen(matchId, player, seq) {
      calls.push(`seen ${matchId} ${player} ${seq}`);
      return inner.seen(matchId, player, seq);
    },
    keep(matchId, player, seq) {
      calls.push(`keep ${matchId} ${player} ${seq}`);
      return inner.keep(matchId, player, seq);
    },
    due(now) {
      calls.push("due");
      return inner.due(now);
    },
    markSent(alert, now) {
      calls.push("markSent");
      return inner.markSent(alert, now);
    },
    waitingSeq(alert) {
      calls.push("waitingSeq");
      return inner.waitingSeq(alert);
    },
  };
}

export type SeenWorld = {
  deps: SeenHandlerDeps;
  memory: MemoryStore;
  notify: MemoryNotifyStore;
  start: HostResult;
  /** The players the new match is waiting for; each has a turn alert queued at seq 0. */
  waiting: PlayerId[];
  storeCalls: string[];
  notifyCalls: string[];
  authCalls: string[];
  logged: string[];
};

/** "match-1" between alice and bob at seq 0, its first alerts queued, behind recording stores and fake sign-in. */
export async function seenWorld(): Promise<SeenWorld> {
  const { store: memory, notify, start, waiting } = await alertWorld();
  const storeCalls: string[] = [];
  const notifyCalls: string[] = [];
  const authCalls: string[] = [];
  const logged: string[] = [];
  return {
    deps: {
      authenticate: (token) => {
        authCalls.push(token);
        return Promise.resolve(TOKENS[token] ?? null);
      },
      store: recordingStore(memory, storeCalls),
      notify: recordingNotify(notify, notifyCalls),
      log: (line) => logged.push(line),
    },
    memory,
    notify,
    start,
    waiting,
    storeCalls,
    notifyCalls,
    authCalls,
    logged,
  };
}
