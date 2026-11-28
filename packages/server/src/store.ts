// The storage port behind `submit` (docs/architecture.md, Decision 5), and an in-memory store for tests.
// The secret is passed through unopened: server code never looks inside the game state.
import type { Viewer } from "@terminal-dusk/engine";
import type { Frame, MatchRecord, MatchSecret, PlayerId } from "@terminal-dusk/host";
import type { DeadlineStore } from "./deadlineStore.ts";
import { dueIds } from "./deadlineStore.ts";
import { later } from "./later.ts";
import { matchRowFor } from "./matchRow.ts";
import type { RatingChange, RatingRow, RatingWrite } from "./ratings.ts";
import type { ReadStore, StoredRows } from "./read.ts";
import { rowsFor } from "./rows.ts";

/** What `load` gives: the readable record and the server-only secret. */
export type LoadedMatch = { record: MatchRecord; secret: MatchSecret };

/**
 * What `commit` saves, all together: the new record, the new secret and each viewer's latest frame, and, for the
 * step that finishes a ranked game (#679), both players' new rating rows (finalize.ts).
 */
export type MatchWrite = {
  record: MatchRecord;
  secret: MatchSecret;
  frames: Record<Viewer, Frame>;
  ratings?: RatingWrite[];
};

/**
 * `saved`: everything was written. `conflict`: the stored seq had moved on, so nothing was written.
 * `ratingsMoved`: the seq matched, but a player's stored ranked-game count was no longer the write's `expected`
 * (another finish rated them first), so nothing was written; finalize.ts reads the ratings again and retries.
 */
export type CommitResult = SaveResult | "ratingsMoved";

/** What a save without ratings can answer: `saved` or `conflict`, as for `commit`. */
export type SaveResult = "saved" | "conflict";

/** Where matches live. The Supabase adapter (a later task) and the in-memory store both implement it. */
export interface MatchStore {
  /** The match, or `null` when no match has this id. */
  load(matchId: string): Promise<LoadedMatch | null>;
  /** Saves `write` only when the stored `record.seq` still equals `expectedSeq` (`where seq = expectedSeq`). */
  commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult>;
  /** The stored rating rows of these players; a player with no row (unrated) has none in the answer. */
  ratings(players: readonly PlayerId[]): Promise<RatingRow[]>;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * A `MatchStore` held in memory. It keeps copies, so callers cannot change what is stored by accident.
 * Alongside each match it keeps the readable rows (rows.ts): every write replaces the `match` row and
 * the three `match_view` rows, and adds three `match_event` rows. `saveClock` replaces only the record
 * and the `match` row. It keeps the `rating` rows too, by player.
 */
export class MemoryStore implements MatchStore, ReadStore, DeadlineStore {
  readonly #matches = new Map<string, MatchWrite>();
  readonly #rows = new Map<string, StoredRows>();
  readonly #ratings = new Map<PlayerId, RatingRow>();
  readonly #changes = new Map<string, RatingChange>();

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
      const ratings = write.ratings ?? [];
      if (ratings.some(({ expected, row }) => (this.#ratings.get(row.player)?.ranked_games ?? 0) !== expected))
        return "ratingsMoved";
      for (const { row, change } of ratings) {
        this.#ratings.set(row.player, copy(row));
        this.#changes.set(`${change.match_id}/${change.player}`, copy(change));
      }
      const next = rowsFor(write);
      this.#matches.set(matchId, copy({ record: write.record, secret: write.secret, frames: write.frames }));
      this.#rows.set(matchId, { match: next.match, views: next.views, events: [...rows.events, ...next.events] });
      return "saved";
    });
  }

  ratings(players: readonly PlayerId[]): Promise<RatingRow[]> {
    return later(() =>
      players.flatMap((player) => (this.#ratings.has(player) ? [copy(this.#ratings.get(player)!)] : [])),
    );
  }

  /** A copy of the rating changes saved for the match, ordered by player id. For tests. */
  ratingChanges(matchId: string): RatingChange[] {
    return [...this.#changes.values()]
      .filter((c) => c.match_id === matchId)
      .toSorted((a, b) => (a.player < b.player ? -1 : a.player > b.player ? 1 : 0))
      .map(copy);
  }

  /** Puts in a rating row as if an earlier ranked game had written it. For tests. */
  putRating(row: RatingRow): void {
    this.#ratings.set(row.player, copy(row));
  }

  due(now: number): Promise<string[]> {
    return later(() =>
      dueIds(
        [...this.#matches].map(([id, write]) => [id, write.record] as const),
        now,
      ),
    );
  }

  saveClock(matchId: string, expectedSeq: number, record: MatchRecord): Promise<SaveResult> {
    return later((): SaveResult => {
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
