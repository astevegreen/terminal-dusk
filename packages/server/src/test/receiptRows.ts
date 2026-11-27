// Receipt references for the stack tests (#683), and the clean-up of every row they leave in the three tables a
// receipt can touch. Call `receiptRows` inside `onLocalStack`, so its `afterAll` is registered with the tests.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll } from "vitest";
import type { UnmatchedReason } from "../entitlementReceipts.ts";
import { freshId } from "../migrations/localStack.ts";

const TABLES = ["entitlement", "entitlement_refund", "checkout_unmatched"] as const;

export function receiptRows(service: () => SupabaseClient) {
  const used: string[] = [];

  afterAll(async () => {
    if (used.length === 0) return;
    for (const table of TABLES) await service().from(table).delete().in("receipt_ref", used);
  }, 60_000);

  return {
    /** A receipt reference no run has used, kept for clean-up. */
    fresh(): string {
      const ref = `test-receipt-${freshId()}`;
      used.push(ref);
      return ref;
    },
    /** The reasons recorded for an unmatched receipt. */
    async unmatched(source: string, receiptRef: string): Promise<UnmatchedReason[]> {
      const { data, error } = await service()
        .from("checkout_unmatched")
        .select("reason")
        .eq("source", source)
        .eq("receipt_ref", receiptRef);
      if (error) throw new Error(`reading checkout_unmatched failed with ${error.code}`);
      return (data as { reason: UnmatchedReason }[]).map((row) => row.reason);
    },
  };
}
