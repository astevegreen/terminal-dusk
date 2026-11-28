// The read model (docs/architecture.md, Decision 5): the rows a client may read, as each commit writes
// them. Field names are the SQL column names. Rows are built from the record and frames only, never the secret.
import type { GameEvent, GameStatus, RulesetId, Seed, Side, Viewer } from "@terminal-dusk/engine";
import type { Frame, MatchClock, MatchRecord, PlayerId } from "@terminal-dusk/host";
import { matchRowFor } from "./matchRow.ts";

/** The three live viewers, in the order their rows are written. */
export const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];

/** One row of the `match` table: who plays, the ruleset, the seed's hash and, once the game is over, the seed. */
export type MatchRow = {
  match_id: string;
  lio_player: PlayerId;
  sae_player: PlayerId;
  ruleset: RulesetId;
  seed_hash: string;
  /** Null while the game is active; the seed once it is over, so anyone can re-check the game. */
  seed: Seed | null;
  seq: number;
  status: GameStatus;
  created_at: number;
  updated_at: number;
  /** The match's deadline clock as the record holds it, or null for a match without one. */
  clock: MatchClock | null;
  /** The earliest deadline while the game is active, else null: what the deadline sweep looks for. */
  next_deadline: number | null;
  /** True only for a ranked match (#679), set when it is created; `commit_match` never changes it. */
  ranked: boolean;
};

/** One row of the `match_view` table: one viewer's latest frame. */
export type MatchViewRow = { match_id: string; viewer: Viewer; seq: number; frame: Frame };

/** One row of the `match_event` table: the events one viewer may see from one step, and who the host played for. */
export type MatchEventRow = {
  match_id: string;
  seq: number;
  viewer: Viewer;
  events: GameEvent[];
  /** The side the host played for in this step (#605), or null for an ordinary step. A side name only. */
  stand_in: Side | null;
};

/** Every row one commit writes: the match row, and one view row and one event row per viewer. */
export type CommitRows = { match: MatchRow; views: MatchViewRow[]; events: MatchEventRow[] };

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The rows for one commit, built from its record and frames. It takes no secret, so it cannot read one.
 * The result shares nothing with the inputs.
 */
export function rowsFor(commit: { record: MatchRecord; frames: Record<Viewer, Frame> }): CommitRows {
  const { record, frames } = commit;
  const match = matchRowFor(record);
  const views = VIEWERS.map((viewer): MatchViewRow => ({
    match_id: record.matchId,
    viewer,
    seq: frames[viewer].seq,
    frame: copy(frames[viewer]),
  }));
  const events = VIEWERS.map((viewer): MatchEventRow => ({
    match_id: record.matchId,
    seq: frames[viewer].seq,
    viewer,
    events: copy(frames[viewer].events),
    stand_in: frames[viewer].standIn ?? null,
  }));
  return { match, views, events };
}
