// The port for purchases that arrive as messages from a payment provider (docs/architecture.md, Decision 5,
// "Accounts and purchases"): an entitlement is written and removed by the purchase's receipt reference, so a
// message delivered twice, late or out of order can't add a second copy or bring a refunded one back. Only the
// server uses it, with the service role. MemoryEntitlementStore and SupabaseEntitlementStore implement it.
import type { Entitlement, PlayerId } from "@terminal-dusk/host";

/**
 * `granted`: the entitlement was written. `already`: this receipt has one. `refunded`: it was refunded.
 * `chargedBack`: it is charged back, and a reversal will give this buyer the entitlement.
 */
export type GrantStatus = "granted" | "already" | "refunded" | "chargedBack";
/** `revoked`: the receipt's entitlement was removed. `remembered`: it had none; the refund is kept all the same. */
export type RevokeStatus = "revoked" | "remembered";
/** `restored`: the entitlement was written again. `remembered`: nothing was to be given back. */
export type ReversalStatus = "restored" | "remembered";
/** Why a purchase could not be given to a player: no id, text that is no player id, or an id no account has. */
export type UnmatchedReason = "noPlayerId" | "badPlayerId" | "unknownPlayer";

export interface EntitlementReceipts {
  /**
   * Writes the purchase's entitlement for `player`, unless the receipt already has one, was refunded or is charged
   * back.
   */
  grantReceipt(player: PlayerId, entitlement: Entitlement, receiptRef: string): Promise<GrantStatus>;
  /** Removes the receipt's entitlement and refuses any later grant of it. */
  revokeReceipt(source: string, receiptRef: string): Promise<RevokeStatus>;
  /**
   * Records a chargeback of the receipt, made at `at` (milliseconds since 1970). Unless a reversal is as new, the
   * entitlement is removed and its buyer kept for the reversal.
   */
  chargeBackReceipt(source: string, receiptRef: string, at: number): Promise<RevokeStatus>;
  /**
   * Records that a chargeback of the receipt was reversed at `at`. Unless a chargeback is newer or the receipt was
   * refunded, the kept buyer gets the entitlement again.
   */
  reverseChargeback(source: string, receiptRef: string, at: number): Promise<ReversalStatus>;
  /** Keeps a purchase no player could be found for, so a person can settle it; the first record stays. */
  recordUnmatched(source: string, receiptRef: string, reason: UnmatchedReason): Promise<void>;
}
