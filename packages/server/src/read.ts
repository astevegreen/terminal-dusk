// Who may read which row (docs/architecture.md, Decision 5, "Who can read it"), and the read itself.
// Nothing here can reach `match_secret`: the read port only holds the readable rows.
import type { PlayerId } from "@terminal-dusk/host";
import type { MatchEventRow, MatchRow, MatchViewRow } from "./rows.ts";

/** Who is asking: a signed-in player's id, or `null` for nobody signed in. */
export type Caller = PlayerId | null;

/** All the readable rows of one match: the match row, the latest view rows, and every event row so far. */
export type StoredRows = { match: MatchRow; views: MatchViewRow[]; events: MatchEventRow[] };

/** Where the readable rows live. It has no way to give out the secret. */
export interface ReadStore {
  /** The match's readable rows, or `null` when no match has this id. */
  rows(matchId: string): Promise<StoredRows | null>;
}

/** What `readMatch` gives: the match row and the view and event rows this caller may read. */
export type MatchRead = { match: MatchRow; views: MatchViewRow[]; events: MatchEventRow[] };

/**
 * Whether `caller` may read `row` of the match described by `match`. Anyone may read the match row and
 * the spectator rows; the `lio` rows only the match's LIO player; the `sae` rows only its SAE player.
 */
export function canRead(caller: Caller, match: MatchRow, row: MatchRow | MatchViewRow | MatchEventRow): boolean {
  if (!("viewer" in row)) return true;
  if (row.viewer === "spectator") return true;
  if (caller === null) return false;
  return row.viewer === "lio" ? caller === match.lio_player : caller === match.sae_player;
}

/**
 * The match row, the view rows `caller` may read, and the event rows it may read with `seq` greater
 * than `afterSeq`, oldest first. An unknown match gives `null`.
 */
export async function readMatch(
  store: ReadStore,
  matchId: string,
  caller: Caller,
  afterSeq: number,
): Promise<MatchRead | null> {
  const stored = await store.rows(matchId);
  if (stored === null) return null;
  const { match } = stored;
  const views = stored.views.filter((row) => canRead(caller, match, row));
  const events = stored.events
    .filter((row) => row.seq > afterSeq && canRead(caller, match, row))
    .sort((a, b) => a.seq - b.seq);
  return { match, views, events };
}
