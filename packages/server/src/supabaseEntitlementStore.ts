// The Supabase side of the entitlement port (docs/architecture.md, Decision 5). The server reads with a client made
// with the service role key; a signed-in player may read only their own rows, and no client may write them.
// No error it throws carries a row, a player id, a receipt reference or a key, so it can be logged.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEntitlement } from "@terminal-dusk/host";
import type { Entitlement, PlayerId } from "@terminal-dusk/host";
import type { EntitlementStore } from "./entitlementStore.ts";

/**
 * An entitlement storage failure. Its message names only the reason and the database's error code: never the
 * database's own message or details, which may quote a row.
 */
export class EntitlementStorageError extends Error {
  constructor(reason: string) {
    super(`Entitlement read failed: ${reason}.`);
    this.name = "EntitlementStorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

/** An `EntitlementStore` over the `entitlement` table. */
export class SupabaseEntitlementStore implements EntitlementStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key, so it can read any player's rows. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  /** Reads only `platform` and `source`, ordered by `created_at` then `id`; never the receipt reference. */
  async forPlayer(player: PlayerId): Promise<Entitlement[]> {
    let answer: { data: unknown; error: { code?: string } | null };
    try {
      answer = await this.#db
        .from("entitlement")
        .select("platform, source")
        .eq("player", player)
        .order("created_at")
        .order("id");
    } catch {
      throw new EntitlementStorageError("the database did not answer");
    }
    if (answer.error) throw new EntitlementStorageError(reasonOf(answer.error));
    if (!Array.isArray(answer.data)) throw new EntitlementStorageError("the database gave an unexpected answer");
    const rows: unknown[] = answer.data;
    if (!rows.every(isEntitlement)) throw new EntitlementStorageError("an entitlement row is malformed");
    return rows.map(({ platform, source }) => ({ platform, source }));
  }
}
