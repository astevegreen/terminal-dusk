// The Supabase side of the storage port (docs/architecture.md, Decision 5). It runs only with a client made
// with the service role key: clients can neither read `match_secret` nor run `commit_match`.
// The secret is passed through unopened, and no error it throws carries a row, the secret, a seed or a key.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchSecret } from "@terminal-dusk/host";
import { recordFromRow } from "./matchRow.ts";
import type { MatchRow } from "./rows.ts";
import { rowsFor } from "./rows.ts";
import type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";

/** The `match` columns, then the match's `match_secret` row embedded in the same query. */
const LOAD_COLUMNS =
  "match_id, lio_player, sae_player, ruleset, seed_hash, seed, seq, status, created_at, updated_at, " +
  "match_secret(secret)";

type SecretRow = { secret: MatchSecret };
type LoadedRow = MatchRow & { match_secret: SecretRow | SecretRow[] | null };

/**
 * A storage failure. Its message names only the step, the match id and the database's error code, so it
 * can be logged: never the database's own message or details, which may quote a row.
 */
export class StorageError extends Error {
  constructor(step: "load" | "commit", matchId: string, reason: string) {
    super(`Storage ${step} failed for match ${matchId}: ${reason}.`);
    this.name = "StorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

/** A `MatchStore` over the `match`, `match_secret`, `match_view` and `match_event` tables. */
export class SupabaseStore implements MatchStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  /** One query reads the match row and its secret together, so both always come from the same commit. */
  async load(matchId: string): Promise<LoadedMatch | null> {
    let answer;
    try {
      answer = await this.#db.from("match").select(LOAD_COLUMNS).eq("match_id", matchId).maybeSingle();
    } catch {
      throw new StorageError("load", matchId, "the database did not answer");
    }
    const { data, error } = answer;
    if (error) throw new StorageError("load", matchId, reasonOf(error));
    if (data === null) return null;
    const { match_secret: embedded, ...row } = data as unknown as LoadedRow;
    const secretRow = Array.isArray(embedded) ? embedded[0] : embedded;
    if (!secretRow) throw new StorageError("load", matchId, "the match has no secret row");
    return { record: recordFromRow(row), secret: secretRow.secret };
  }

  /** Builds the commit's rows (rows.ts) and saves them all in one call to the `commit_match` SQL function. */
  async commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult> {
    const rows = rowsFor(write);
    let answer;
    try {
      answer = await this.#db.rpc("commit_match", {
        p_match_id: matchId,
        p_expected_seq: expectedSeq,
        p_match: rows.match,
        p_secret: write.secret,
        p_views: rows.views,
        p_events: rows.events,
      });
    } catch {
      throw new StorageError("commit", matchId, "the database did not answer");
    }
    const { data, error } = answer;
    if (error) throw new StorageError("commit", matchId, reasonOf(error));
    if (data === "saved" || data === "conflict") return data;
    throw new StorageError("commit", matchId, "the database gave an unexpected answer");
  }
}
