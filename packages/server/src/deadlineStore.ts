// The storage port behind the deadline sweep (docs/architecture.md, Decision 5, "Scheduled jobs").
// MemoryStore implements it now; the Supabase store gets it in a later task.
import type { MatchRecord } from "@terminal-dusk/host";
import type { CommitResult } from "./store.ts";

/** What the deadline sweep needs from storage, alongside `MatchStore`. */
export interface DeadlineStore {
  /**
   * The ids of active matches with a clock whose earliest deadline is at or before `now`, sorted by that
   * deadline, then by match id.
   */
  due(now: number): Promise<string[]>;
  /**
   * Replaces only the match record (and its `match` row) when the stored seq still equals `expectedSeq`.
   * It writes no frames and no event rows: a grace extension does not move the game on.
   */
  saveClock(matchId: string, expectedSeq: number, record: MatchRecord): Promise<CommitResult>;
}

/** The earliest deadline of an active match with a clock, or `null` when it has none. */
export function earliestDeadline(record: MatchRecord): number | null {
  if (record.status.kind !== "active" || !record.clock) return null;
  const { lio, sae } = record.clock.deadlines;
  const times = [lio, sae].filter((t): t is number => typeof t === "number");
  return times.length === 0 ? null : Math.min(...times);
}

/** The ids of the due matches among `[matchId, record]` pairs, in `due` order (deadline, then match id). */
export function dueIds(matches: Iterable<readonly [string, MatchRecord]>, now: number): string[] {
  return [...matches]
    .flatMap(([id, record]) => {
      const at = earliestDeadline(record);
      return at !== null && at <= now ? [{ id, at }] : [];
    })
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : Number(a.id > b.id)))
    .map((entry) => entry.id);
}
