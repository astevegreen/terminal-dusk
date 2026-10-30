// The storage port over the Supabase match tables (docs/architecture.md, Decision 5). It needs a client made
// with the service role key: only that role may read match_secret or run commit_match. A failed call throws
// an error that names the step and the database's error code only, never the database's own text, which
// could quote a row (and so the secret).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchSecret } from "@terminal-dusk/host";
import { recordFromRow } from "./matchRow.ts";
import type { MatchRow } from "./rows.ts";
import { rowsFor } from "./rows.ts";
import type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";

/** The SQL function that saves one commit in one transaction (supabase/migrations/*_commit_match.sql). */
export const COMMIT_FUNCTION = "commit_match";

/** The match row with its secret row embedded, read in one query so both come from the same commit. */
const LOAD_COLUMNS =
  "match_id, lio_player, sae_player, ruleset, seed_hash, seed, seq, status, created_at, updated_at, match_secret(secret)";

type SecretRow = { secret: MatchSecret };
type LoadedRow = MatchRow & { match_secret: SecretRow | SecretRow[] | null };
type DbError = { code?: string } | null;

/** An error that says which step failed and the database's code, and nothing the database said. */
const failure = (step: string, error?: DbError): Error =>
  new Error(`The match store could not ${step}${error?.code ? ` (database code ${error.code})` : ""}.`);

/** Runs one database call; anything it throws becomes a `failure` without the thrown text. */
async function guarded<T>(step: string, call: () => PromiseLike<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw failure(step);
  }
}

/** The one secret row embedded in a loaded match row, or null when there is none. */
function secretOf(row: LoadedRow): MatchSecret | null {
  const embedded = Array.isArray(row.match_secret) ? row.match_secret : [row.match_secret];
  const found = embedded.filter((s): s is SecretRow => s !== null && typeof s === "object");
  return found.length === 1 ? found[0]!.secret : null;
}

export class SupabaseStore implements MatchStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async load(matchId: string): Promise<LoadedMatch | null> {
    const step = "read the match";
    const { data, error } = await guarded(step, () =>
      this.#db.from("match").select(LOAD_COLUMNS).eq("match_id", matchId).maybeSingle(),
    );
    if (error) throw failure(step, error);
    if (data === null) return null;
    const row = data as unknown as LoadedRow;
    const secret = secretOf(row);
    // A match without its secret row is a broken database, not an unknown match.
    if (secret === null) throw failure("find the match's secret row");
    // recordFromRow reads only the match columns, so the embedded secret row is left behind.
    return { record: recordFromRow(row), secret };
  }

  async commit(matchId: string, expectedSeq: number, write: MatchWrite): Promise<CommitResult> {
    const step = "save the match";
    const rows = rowsFor(write);
    const { data, error } = await guarded(step, () =>
      this.#db.rpc(COMMIT_FUNCTION, {
        p_match_id: matchId,
        p_expected_seq: expectedSeq,
        p_match: rows.match,
        p_secret: write.secret,
        p_views: rows.views,
        p_events: rows.events,
      }),
    );
    if (error) throw failure(step, error);
    if (data === true) return "saved";
    if (data === false) return "conflict";
    throw failure(step);
  }
}
