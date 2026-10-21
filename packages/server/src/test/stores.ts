// Test helpers that wrap any MatchStore, for the in-memory and the Supabase store alike.
import type { MatchStore, MatchWrite } from "../store.ts";

/** Wraps a store so that no load returns until `count` loads have finished: every caller sees the same seq. */
export function loadTogether(inner: MatchStore, count: number): MatchStore {
  const waiting: (() => void)[] = [];
  return {
    async load(matchId) {
      const loaded = await inner.load(matchId);
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        if (waiting.length === count) for (const go of waiting.splice(0)) go();
      });
      return loaded;
    },
    commit: (matchId, expectedSeq, write) => inner.commit(matchId, expectedSeq, write),
  };
}

/** Wraps a store so that every write it saves is kept in `saved`, oldest first. */
export function recording(inner: MatchStore): { store: MatchStore; saved: MatchWrite[] } {
  const saved: MatchWrite[] = [];
  const store: MatchStore = {
    load: (matchId) => inner.load(matchId),
    async commit(matchId, expectedSeq, write) {
      const result = await inner.commit(matchId, expectedSeq, write);
      if (result === "saved") saved.push(write);
      return result;
    },
  };
  return { store, saved };
}
