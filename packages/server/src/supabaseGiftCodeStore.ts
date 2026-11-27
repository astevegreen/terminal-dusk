// The Supabase side of the gift code port: one call to the redeem_gift_code SQL function, which claims the code
// and grants its entitlement in one transaction (supabase/migrations/20261127000000_gift_code.sql). The client must
// be made with the service role key: no client role may run the function or read the tables.
// No error it throws carries a hash, a player id or a key, so it can be logged.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerId } from "@terminal-dusk/host";
import { isRedeemOutcome } from "./giftCodeStore.ts";
import type { GiftCodeStore, RedeemOutcome } from "./giftCodeStore.ts";

/**
 * A gift code storage failure. Its message names only the reason and the database's error code: never the
 * database's own message or details, which may quote a row.
 */
export class GiftCodeStorageError extends Error {
  constructor(reason: string) {
    super(`Gift code redeem failed: ${reason}.`);
    this.name = "GiftCodeStorageError";
  }
}

/** A `GiftCodeStore` over the `gift_code` table and its SQL function. */
export class SupabaseGiftCodeStore implements GiftCodeStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async redeem(hash: string, player: PlayerId, now: number): Promise<RedeemOutcome> {
    let answer: { data: unknown; error: { code?: string } | null };
    try {
      answer = await this.#db.rpc("redeem_gift_code", { p_hash: hash, p_player: player, p_now: now });
    } catch {
      throw new GiftCodeStorageError("the database did not answer");
    }
    if (answer.error) {
      const code = answer.error.code;
      throw new GiftCodeStorageError(code ? `database error ${code}` : "the database did not answer");
    }
    if (!isRedeemOutcome(answer.data)) throw new GiftCodeStorageError("the database gave an unexpected answer");
    return answer.data;
  }
}
