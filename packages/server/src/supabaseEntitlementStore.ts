// The Supabase side of the entitlement ports (docs/architecture.md, Decision 5). The server reads and writes with a
// client made with the service role key; a signed-in player may read only their own rows, and no client may write
// them. Purchases are granted and refunded by two database functions, so both happen under one lock per receipt.
// No error it throws carries a row, a player id, a receipt reference or a key, so it can be logged.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEntitlement } from "@terminal-dusk/host";
import type { Entitlement, PlayerId } from "@terminal-dusk/host";
import type { EntitlementReceipts, GrantStatus, RevokeStatus, UnmatchedReason } from "./entitlementReceipts.ts";
import type { EntitlementStore } from "./entitlementStore.ts";

/**
 * An entitlement storage failure. Its message names only the reason and the database's error code: never the
 * database's own message or details, which may quote a row.
 */
export class EntitlementStorageError extends Error {
  constructor(reason: string, action: "read" | "write" = "read") {
    super(`Entitlement ${action} failed: ${reason}.`);
    this.name = "EntitlementStorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

type Written = { data: unknown; error: { code?: string } | null };

/** What a write answered; a database error or no answer at all becomes an EntitlementStorageError. */
async function written(write: () => PromiseLike<Written>): Promise<unknown> {
  let answer: Written;
  try {
    answer = await write();
  } catch {
    throw new EntitlementStorageError("the database did not answer", "write");
  }
  if (answer.error) throw new EntitlementStorageError(reasonOf(answer.error), "write");
  return answer.data;
}

/** The database function's answer, when it is one of `known`. */
function oneOf<T extends string>(known: readonly T[], answer: unknown): T {
  const status = known.find((candidate) => candidate === answer);
  if (status === undefined) throw new EntitlementStorageError("the database gave an unexpected answer", "write");
  return status;
}

/** `EntitlementStore` and `EntitlementReceipts` over the `entitlement` table and its two companions. */
export class SupabaseEntitlementStore implements EntitlementStore, EntitlementReceipts {
  readonly #db: SupabaseClient;
  readonly #now: () => number;

  /** `db` must be made with the service role key, so it can read any player's rows and write them. */
  constructor(db: SupabaseClient, now: () => number = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  async grantReceipt(player: PlayerId, { platform, source }: Entitlement, receiptRef: string): Promise<GrantStatus> {
    const args = {
      p_player: player,
      p_platform: platform,
      p_source: source,
      p_receipt_ref: receiptRef,
      p_now: this.#now(),
    };
    const answer = await written(() => this.#db.rpc("grant_receipt", args));
    return oneOf<GrantStatus>(["granted", "already", "refunded"], answer);
  }

  async revokeReceipt(source: string, receiptRef: string): Promise<RevokeStatus> {
    const args = { p_source: source, p_receipt_ref: receiptRef, p_now: this.#now() };
    const answer = await written(() => this.#db.rpc("revoke_receipt", args));
    return oneOf<RevokeStatus>(["revoked", "remembered"], answer);
  }

  async recordUnmatched(source: string, receiptRef: string, reason: UnmatchedReason): Promise<void> {
    const row = { source, receipt_ref: receiptRef, reason, created_at: this.#now() };
    const options = { onConflict: "source,receipt_ref", ignoreDuplicates: true };
    await written(() => this.#db.from("checkout_unmatched").upsert(row, options));
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
