// The Supabase side of the matchmaking port (docs/architecture.md, Decision 5; #681). It runs only with a client made
// with the service role key. No error it throws carries a player id, a ticket, a row, the secret, a seed or a key.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRankedPreset } from "./rankedPresets.ts";
import type { CreateSeekResult, PairResult, SeekStore, SeekTicket } from "./seekStore.ts";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";

/** One row of the `seek` table. */
export type SeekRow = {
  id: string;
  player: string;
  rating: number;
  preset: string;
  side: string | null;
  created_at: number;
};

const COLUMNS = "id, player, rating, preset, side, created_at";

/** A matchmaking storage failure. Its message names only the step and the database's error code. */
export class SeekStorageError extends Error {
  constructor(step: "create" | "cancel" | "open" | "pair", reason: string) {
    super(`Seek ${step} failed: ${reason}.`);
    this.name = "SeekStorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

/** The ticket a row stands for, or null when the row breaks the ticket rules (the table's checks forbid that). */
export function ticketFromRow(row: SeekRow): SeekTicket | null {
  if (!isRankedPreset(row.preset) || (row.side !== null && row.side !== "lio" && row.side !== "sae")) return null;
  return {
    id: row.id,
    player: row.player,
    rating: row.rating,
    preset: row.preset,
    side: row.side,
    createdAt: row.created_at,
  };
}

async function call<T>(step: "create" | "cancel" | "open" | "pair", run: () => PromiseLike<T>): Promise<T> {
  try {
    return await run();
  } catch {
    throw new SeekStorageError(step, "the database did not answer");
  }
}

/** A `SeekStore` over the `seek` table, `create_seek` and `pair_seeks`. */
export class SupabaseSeekStore implements SeekStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async create(ticket: SeekTicket, limit: number): Promise<CreateSeekResult> {
    const { data, error } = await call("create", () =>
      this.#db.rpc("create_seek", {
        p_id: ticket.id,
        p_player: ticket.player,
        p_rating: ticket.rating,
        p_preset: ticket.preset,
        p_side: ticket.side,
        p_created_at: ticket.createdAt,
        p_limit: limit,
      }),
    );
    if (error) throw new SeekStorageError("create", reasonOf(error));
    if (data === "saved" || data === "limit") return data;
    throw new SeekStorageError("create", "the database gave an unexpected answer");
  }

  async cancel(id: string, player: string): Promise<boolean> {
    const { data, error } = await call("cancel", () =>
      this.#db.from("seek").delete().eq("id", id).eq("player", player).select("id"),
    );
    if (error) throw new SeekStorageError("cancel", reasonOf(error));
    return Array.isArray(data) && data.length > 0;
  }

  async open(): Promise<SeekTicket[]> {
    const { data, error } = await call("open", () =>
      this.#db.from("seek").select(COLUMNS).order("created_at", { ascending: true }).order("id", { ascending: true }),
    );
    if (error) throw new SeekStorageError("open", reasonOf(error));
    const tickets = (data as unknown as SeekRow[]).map(ticketFromRow);
    if (tickets.includes(null)) throw new SeekStorageError("open", "a ticket row is malformed");
    return tickets as SeekTicket[];
  }

  async pair(ids: readonly [string, string], write: MatchWrite): Promise<PairResult> {
    const rows = rowsFor(write);
    const { data, error } = await call("pair", () =>
      this.#db.rpc("pair_seeks", {
        p_first: ids[0],
        p_second: ids[1],
        p_match: rows.match,
        p_secret: write.secret,
        p_views: rows.views,
        p_events: rows.events,
      }),
    );
    if (error) throw new SeekStorageError("pair", reasonOf(error));
    if (data === "paired" || data === "unavailable") return data;
    throw new SeekStorageError("pair", "the database gave an unexpected answer");
  }
}
