// The mapping between a `match` row (rows.ts, the SQL column names) and the host's `MatchRecord`.
// Pure, and it never sees the secret: the seed is in the row only once the game is over.
import type { MatchRecord } from "@terminal-dusk/host";
import { earliestDeadline } from "./deadlineStore.ts";
import type { MatchRow } from "./rows.ts";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The `match` row for a record. The `seed` column is null while the game is active. The `clock` column is
 * the record's clock (null without one); `next_deadline` is its earliest deadline while the game is active.
 */
export function matchRowFor(record: MatchRecord): MatchRow {
  return {
    match_id: record.matchId,
    lio_player: record.players.lio,
    sae_player: record.players.sae,
    ruleset: record.ruleset,
    seed_hash: record.seedHash,
    seed: record.seed ?? null,
    seq: record.seq,
    status: copy(record.status),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    clock: record.clock ? copy(record.clock) : null,
    next_deadline: earliestDeadline(record),
  };
}

/**
 * The record a `match` row stands for. A null `seed` column gives a record with no `seed` field, and a null
 * `clock` column one with no `clock` field. `next_deadline` is worked out from the clock, so it is not read.
 */
export function recordFromRow(row: MatchRow): MatchRecord {
  const record: MatchRecord = {
    matchId: row.match_id,
    players: { lio: row.lio_player, sae: row.sae_player },
    ruleset: row.ruleset,
    seedHash: row.seed_hash,
    seq: row.seq,
    status: copy(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.seed !== null) record.seed = row.seed;
  if (row.clock !== null) record.clock = copy(row.clock);
  return record;
}
