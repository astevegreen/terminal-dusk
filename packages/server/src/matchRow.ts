// The `match` row and the host's MatchRecord, each turned into the other. Pure functions: they take no
// secret, so they cannot read one, and the result shares nothing with the input.
import type { MatchRecord } from "@terminal-dusk/host";
import type { MatchRow } from "./rows.ts";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The `match` row for a record, in the SQL column names. The seed column is null while the game is active. */
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
  };
}

/** The record a `match` row stands for. A null seed column means the record has no `seed` field. */
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
  return record;
}
