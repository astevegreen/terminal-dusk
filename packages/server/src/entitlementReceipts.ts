// The port for purchases that arrive as messages from a payment provider (docs/architecture.md, Decision 5,
// "Accounts and purchases"): an entitlement is written and removed by the purchase's receipt reference, so a
// message delivered twice, late or out of order can't add a second copy or bring a refunded one back. Only the
// server uses it, with the service role. MemoryEntitlementStore and SupabaseEntitlementStore implement it.
import type { Entitlement, PlayerId } from "@terminal-dusk/host";

/** `granted`: the entitlement was written. `already`: this receipt has one. `refunded`: it was refunded. */
export type GrantStatus = "granted" | "already" | "refunded";
/** `revoked`: the receipt's entitlement was removed. `remembered`: it had none; the refund is kept all the same. */
export type RevokeStatus = "revoked" | "remembered";
/** Why a purchase could not be given to a player: no id, text that is no player id, or an id no account has. */
export type UnmatchedReason = "noPlayerId" | "badPlayerId" | "unknownPlayer";

export interface EntitlementReceipts {
  /** Writes the purchase's entitlement for `player`, unless the receipt already has one or was refunded. */
  grantReceipt(player: PlayerId, entitlement: Entitlement, receiptRef: string): Promise<GrantStatus>;
  /** Removes the receipt's entitlement and refuses any later grant of it. */
  revokeReceipt(source: string, receiptRef: string): Promise<RevokeStatus>;
  /** Keeps a purchase no player could be found for, so a person can settle it; the first record stays. */
  recordUnmatched(source: string, receiptRef: string, reason: UnmatchedReason): Promise<void>;
}
