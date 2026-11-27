// The write half of SupabaseEntitlementStore (#683) against a stand-in client, so these run without the local
// stack. stores.contract.stack.test.ts proves the behaviour against the real tables and functions.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { shown, thrown } from "./test/errors.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const PLAYER = "00000000-0000-4000-8000-000000000001";
const FAKE_KEY = "service-key-that-must-not-leak";
const RECEIPT = "receipt-ref-that-must-not-leak";
const COPY = { platform: "web", source: "paddle" } as const;
const NOW = 1_700_000_000_000;
/** When Paddle made a chargeback or its reversal. */
const AT = 1_699_000_000_000;

/** A stand-in client: each write gives `answer` (or throws), and every call is kept. */
function fakeStore(answer: Answer | "throws") {
  const calls: { call: string; args: unknown }[] = [];
  const settle = async (): Promise<Answer> => {
    if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY}`);
    return answer;
  };
  const db = {
    rpc: (name: string, args: unknown) => (calls.push({ call: name, args }), settle()),
    from: (table: string) => ({
      upsert: (row: unknown, options: unknown) => (calls.push({ call: table, args: [row, options] }), settle()),
    }),
  } as unknown as SupabaseClient;
  return { store: new SupabaseEntitlementStore(db, () => NOW), calls };
}

describe("SupabaseEntitlementStore receipt writes", () => {
  it.each(["granted", "already", "refunded", "chargedBack"])(
    "grants through grant_receipt and answers %s",
    async (status) => {
      const { store, calls } = fakeStore({ data: status, error: null });
      expect(await store.grantReceipt(PLAYER, COPY, RECEIPT)).toBe(status);
      const args = { p_player: PLAYER, p_platform: "web", p_source: "paddle", p_receipt_ref: RECEIPT, p_now: NOW };
      expect(calls).toEqual([{ call: "grant_receipt", args }]);
    },
  );

  it.each(["revoked", "remembered"])("revokes through revoke_receipt and answers %s", async (status) => {
    const { store, calls } = fakeStore({ data: status, error: null });
    expect(await store.revokeReceipt("paddle", RECEIPT)).toBe(status);
    const args = { p_source: "paddle", p_receipt_ref: RECEIPT, p_now: NOW };
    expect(calls).toEqual([{ call: "revoke_receipt", args }]);
  });

  it.each(["revoked", "remembered"])("charges back through chargeback_receipt and answers %s", async (status) => {
    const { store, calls } = fakeStore({ data: status, error: null });
    expect(await store.chargeBackReceipt("paddle", RECEIPT, AT)).toBe(status);
    const args = { p_source: "paddle", p_receipt_ref: RECEIPT, p_at: AT };
    expect(calls).toEqual([{ call: "chargeback_receipt", args }]);
  });

  it.each(["restored", "remembered"])("reverses through reverse_chargeback and answers %s", async (status) => {
    const { store, calls } = fakeStore({ data: status, error: null });
    expect(await store.reverseChargeback("paddle", RECEIPT, AT)).toBe(status);
    const args = { p_source: "paddle", p_receipt_ref: RECEIPT, p_at: AT, p_now: NOW };
    expect(calls).toEqual([{ call: "reverse_chargeback", args }]);
  });

  it("records an unmatched checkout once, keeping the first record", async () => {
    const { store, calls } = fakeStore({ data: null, error: null });
    await store.recordUnmatched("paddle", RECEIPT, "unknownPlayer");
    const row = { source: "paddle", receipt_ref: RECEIPT, reason: "unknownPlayer", created_at: NOW };
    const options = { onConflict: "source,receipt_ref", ignoreDuplicates: true };
    expect(calls).toEqual([{ call: "checkout_unmatched", args: [row, options] }]);
  });

  const writes = {
    grantReceipt: (s: SupabaseEntitlementStore) => s.grantReceipt(PLAYER, COPY, RECEIPT),
    revokeReceipt: (s: SupabaseEntitlementStore) => s.revokeReceipt("paddle", RECEIPT),
    chargeBackReceipt: (s: SupabaseEntitlementStore) => s.chargeBackReceipt("paddle", RECEIPT, AT),
    reverseChargeback: (s: SupabaseEntitlementStore) => s.reverseChargeback("paddle", RECEIPT, AT),
    recordUnmatched: (s: SupabaseEntitlementStore) => s.recordUnmatched("paddle", RECEIPT, "noPlayerId"),
  };

  it.each([
    ["grantReceipt", "revoked"],
    ["revokeReceipt", "granted"],
    ["chargeBackReceipt", "restored"],
    ["reverseChargeback", "revoked"],
  ] as const)("%s throws on an answer it does not know", async (name, data) => {
    const { store } = fakeStore({ data, error: null });
    const message = "Entitlement write failed: the database gave an unexpected answer.";
    await expect(writes[name](store)).rejects.toThrow(message);
  });

  it.each(Object.keys(writes) as (keyof typeof writes)[])(
    "%s throws a storage error showing no player, receipt reference or key",
    async (name) => {
      const quoting: Answer = {
        data: null,
        error: { code: "XX000", message: `failing row (${PLAYER}, ${RECEIPT})`, details: FAKE_KEY },
      };
      for (const answer of [quoting, "throws"] as const) {
        const error = await thrown(() => writes[name](fakeStore(answer).store));
        expect(error).toBeInstanceOf(Error);
        const text = shown(error);
        expect(text).toMatch(/Entitlement write failed/);
        for (const hidden of [PLAYER, RECEIPT, FAKE_KEY]) expect(text).not.toContain(hidden);
      }
    },
  );
});
