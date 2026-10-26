// The storage port behind `submit` (docs/architecture.md, Decision 5), and an in-memory store for tests.
// The secret is passed through unopened: server code never looks inside the game state.
import type { Viewer } from "@terminal-dusk/engine";
import type { Frame, MatchRecord, MatchSecret } from "@terminal-dusk/host";
import type { DeadlineStore } from "./deadlineStore.ts";
import { dueIds } from "./deadlineStore.ts";
import { later } from "./later.ts";
import { matchRowFor } from "./matchRow.ts";
import type { ReadStore, StoredRows } from "./read.ts";
import { rowsFor } from "./rows.ts";

/** What `load` gives: the readable record and the server-only secret. */
export type LoadedMatch = { record: MatchRecord; secret: MatchSecret };

/** What `commit` saves, all together: the new record, the new secret and each viewer's latest frame. */
export type MatchWrite = { record: MatchRecord; secret: MatchSecret; frames: Record<Viewer, Frame> };

/** `saved`: all three were written. `conflict`: the stored seq had moved on, so nothing was written. */
export type CommitResult = "saved" | "conflict";

/** Where matches live. The Supabase adapter (a later task) and the in-memory store both implement it. */
export interface MatchStore {
  /** The match, or `null` when no match has this id. */
  load(matchId: string): Promise<LoadedMatch | null>;
  /** Saves `write` only when the stored `record.seq` still equals `expectedSeq` (`where seq = expectedSeq`). */
  commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult>;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * A `MatchStore` held in memory. It keeps copies, so callers cannot change what is stored by accident.
 * Alongside each match it keeps the readable rows (rows.ts): every write replaces the `match` row and
 * the three `match_view` rows, and adds three `match_event` rows. `saveClock` replaces only the record
 * and the `match` row.
 */
export class MemoryStore implements MatchStore, ReadStore, DeadlineStore {
  readonly #matches = new Map<string, MatchWrite>();
  readonly #rows = new Map<string, StoredRows>();

  /** Puts in a match just made by `hostCreate` (seq 0), with its seq 0 rows. Creating through the port is a later task. */
  insert(matchId: string, write: MatchWrite): void {
    this.#matches.set(matchId, copy(write));
    this.#rows.set(matchId, rowsFor(write));
  }

  /** A copy of everything stored for the match, frames included, or `null`. For tests. */
  stored(matchId: string): MatchWrite | null {
    const found = this.#matches.get(matchId);
    return found ? copy(found) : null;
  }

  load(matchId: string): Promise<LoadedMatch | null> {
    return later(() => {
      const found = this.#matches.get(matchId);
      return found ? copy({ record: found.record, secret: found.secret }) : null;
    });
  }

  commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult> {
    return later((): CommitResult => {
      const found = this.#matches.get(matchId);
      const rows = this.#rows.get(matchId);
      if (!found || !rows || found.record.seq !== expectedSeq) return "conflict";
      const next = rowsFor(write);
      this.#matches.set(matchId, copy(write));
      this.#rows.set(matchId, { match: next.match, views: next.views, events: [...rows.events, ...next.events] });
      return "saved";
    });
  }

  due(now: number): Promise<string[]> {
    return later(() =>
      dueIds(
        [...this.#matches].map(([id, write]) => [id, write.record] as const),
        now,
      ),
    );
  }

  saveClock(matchId: string, expectedSeq: number, record: MatchRecord): Promise<CommitResult> {
    return later((): CommitResult => {
      const found = this.#matches.get(matchId);
      const rows = this.#rows.get(matchId);
      if (!found || !rows || found.record.seq !== expectedSeq) return "conflict";
      this.#matches.set(matchId, { ...found, record: copy(record) });
      this.#rows.set(matchId, { ...rows, match: matchRowFor(record) });
      return "saved";
    });
  }

  /** A copy of the match's readable rows, or `null`. It holds nothing from the secret. */
  rows(matchId: string): Promise<StoredRows | null> {
    return later(() => {
      const found = this.#rows.get(matchId);
      return found ? copy(found) : null;
    });
  }
}
