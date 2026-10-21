// The Supabase side of the invite port (docs/architecture.md, Decision 5). It runs only with a client made with
// the service role key: clients can neither read `match_invite` nor run `accept_invite`.
// No error it throws carries the invite code, a row, the secret, a seed or a key, so it can be logged.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sideModeOf } from "./invite.ts";
import type { AcceptResult, Invite, InviteStore, SaveResult, SideMode, StoredInvite } from "./inviteStore.ts";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";

/** One row of the `match_invite` table. `joiner_id` and `match_id` are null until someone joins. */
export type InviteRow = {
  code: string;
  host_id: string;
  mode: SideMode["mode"];
  host_side: string | null;
  created_at: number;
  joiner_id: string | null;
  match_id: string | null;
};

const COLUMNS = "code, host_id, mode, host_side, created_at, joiner_id, match_id";
/** Postgres's "unique violation": the code is already taken. */
const UNIQUE_VIOLATION = "23505";

/**
 * An invite storage failure. Its message names only the step, the database's error code and, for `accept`,
 * the match id: never the code, the database's own message or details, which may quote a row.
 */
export class InviteStorageError extends Error {
  constructor(step: "save" | "find" | "accept", reason: string, matchId?: string) {
    super(`Invite ${step} failed${matchId === undefined ? "" : ` for match ${matchId}`}: ${reason}.`);
    this.name = "InviteStorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

/** The row for a new, unused invite. */
export function inviteRowFor(invite: Invite): InviteRow {
  return {
    code: invite.code,
    host_id: invite.host,
    mode: invite.sides.mode,
    host_side: invite.sides.mode === "host" ? invite.sides.hostSide : null,
    created_at: invite.createdAt,
    joiner_id: null,
    match_id: null,
  };
}

/** The invite a row stands for, or null when the row breaks the invite rules (the table's checks forbid that). */
export function inviteFromRow(row: InviteRow): StoredInvite | null {
  const sides = sideModeOf(row.host_side === null ? { mode: row.mode } : { mode: row.mode, hostSide: row.host_side });
  if (sides === null) return null;
  const { joiner_id: joiner, match_id: matchId } = row;
  return {
    code: row.code,
    host: row.host_id,
    sides,
    createdAt: row.created_at,
    accepted: joiner !== null && matchId !== null ? { joiner, matchId } : null,
  };
}

/** Runs one database call, turning a thrown network failure into an `InviteStorageError`. */
async function call<T>(step: "save" | "find" | "accept", run: () => PromiseLike<T>, matchId?: string): Promise<T> {
  try {
    return await run();
  } catch {
    throw new InviteStorageError(step, "the database did not answer", matchId);
  }
}

/** An `InviteStore` over the `match_invite` table and the match tables. */
export class SupabaseInviteStore implements InviteStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  /** Inserts the invite unused. The code is the primary key, so an existing code is a clash and changes nothing. */
  async save(invite: Invite): Promise<SaveResult> {
    const { error } = await call("save", () => this.#db.from("match_invite").insert(inviteRowFor(invite)));
    if (!error) return "saved";
    if (error.code === UNIQUE_VIOLATION) return "clash";
    throw new InviteStorageError("save", reasonOf(error));
  }

  async find(code: string): Promise<StoredInvite | null> {
    const { data, error } = await call("find", () =>
      this.#db.from("match_invite").select(COLUMNS).eq("code", code).maybeSingle(),
    );
    if (error) throw new InviteStorageError("find", reasonOf(error));
    if (data === null) return null;
    const found = inviteFromRow(data as unknown as InviteRow);
    if (found === null) throw new InviteStorageError("find", "the invite row is malformed");
    return found;
  }

  /** Builds the match's rows (rows.ts) and saves them with the invite's use in one call to `accept_invite`. */
  async accept(code: string, joiner: string, write: MatchWrite): Promise<AcceptResult> {
    const rows = rowsFor(write);
    const matchId = write.record.matchId;
    const { data, error } = await call(
      "accept",
      () =>
        this.#db.rpc("accept_invite", {
          p_code: code,
          p_joiner: joiner,
          p_match: rows.match,
          p_secret: write.secret,
          p_views: rows.views,
          p_events: rows.events,
        }),
      matchId,
    );
    if (error) throw new InviteStorageError("accept", reasonOf(error), matchId);
    if (data === "accepted" || data === "unavailable") return data;
    throw new InviteStorageError("accept", "the database gave an unexpected answer", matchId);
  }
}
