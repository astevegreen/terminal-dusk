// The Supabase side of the checkout limit port: one call to the claim_checkout SQL function
// (supabase/migrations/20261103000000_checkout_attempt.sql). The client must be made with the service role key: no
// client role may run the function or read the table. No error it throws carries a player id or a key.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerId } from "@terminal-dusk/host";
import { isClaimOutcome } from "./checkoutLimitStore.ts";
import type { CheckoutLimitStore, ClaimOutcome } from "./checkoutLimitStore.ts";

/** A checkout limit storage failure. Its message names only the reason and the database's error code. */
export class CheckoutLimitStorageError extends Error {
  constructor(reason: string) {
    super(`Checkout limit claim failed: ${reason}.`);
    this.name = "CheckoutLimitStorageError";
  }
}

/** A `CheckoutLimitStore` over the `checkout_attempt` table and its SQL function. */
export class SupabaseCheckoutLimitStore implements CheckoutLimitStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  async claim(player: PlayerId, now: number): Promise<ClaimOutcome> {
    let answer: { data: unknown; error: { code?: string } | null };
    try {
      answer = await this.#db.rpc("claim_checkout", { p_player: player, p_now: now });
    } catch {
      throw new CheckoutLimitStorageError("the database did not answer");
    }
    if (answer.error) {
      const code = answer.error.code;
      throw new CheckoutLimitStorageError(code ? `database error ${code}` : "the database did not answer");
    }
    if (!isClaimOutcome(answer.data)) throw new CheckoutLimitStorageError("the database gave an unexpected answer");
    return answer.data;
  }
}
