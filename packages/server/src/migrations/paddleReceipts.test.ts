// The checkout receipts migration (#683) on the local Supabase stack. `pnpm test:migrations` applies every
// migration to an empty database first. What granting and refunding do is checked by the EntitlementReceipts
// contract (stores.contract.stack.test.ts); here: the two new tables' columns and checks, one entitlement per
// Paddle receipt, and that no client can read the new tables or run the two functions.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { entitlementStack } from "../test/entitlementStack.ts";
import { receiptRows } from "../test/receiptRows.ts";
import { onLocalStack } from "../test/stack.ts";
import { client } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

await onLocalStack("checkout receipts migration on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const receipts = receiptRows(() => stack.service);
  const insert = async (table: string, row: Record<string, unknown>) =>
    (await stack.service.from(table).insert(row)).error;
  const read = async (table: string, ref: string) =>
    (await stack.service.from(table).select("*").eq("receipt_ref", ref)).data;
  const copy = (source: string, receiptRef: string | null) => ({
    player: stack.owner.id,
    platform: "web",
    source,
    receipt_ref: receiptRef,
    created_at: NOW,
  });
  const grant = (ref: string) => ({
    p_player: stack.owner.id,
    p_platform: "web",
    p_source: "paddle",
    p_receipt_ref: ref,
    p_now: NOW,
  });

  it("grant_receipt writes the entitlement with the receipt reference and time", async () => {
    const ref = receipts.fresh();
    const answer = await stack.service.rpc("grant_receipt", grant(ref));
    expect([answer.error, answer.data]).toEqual([null, "granted"]);
    expect(await read("entitlement", ref)).toEqual([{ ...copy("paddle", ref), id: expect.any(String) }]);
  });

  it("revoke_receipt removes the entitlement and keeps when it was refunded", async () => {
    const ref = receipts.fresh();
    await stack.service.rpc("grant_receipt", grant(ref));
    const args = { p_source: "paddle", p_receipt_ref: ref, p_now: NOW + 1 };
    const answer = await stack.service.rpc("revoke_receipt", args);
    expect([answer.error, answer.data]).toEqual([null, "revoked"]);
    await stack.service.rpc("revoke_receipt", { ...args, p_now: NOW + 2 });
    expect(await read("entitlement", ref)).toEqual([]);
    expect(await read("entitlement_refund", ref)).toEqual([
      { source: "paddle", receipt_ref: ref, refunded_at: NOW + 1 },
    ]);
  });

  it("a Paddle receipt can hold only one entitlement", async () => {
    const ref = receipts.fresh();
    expect(await insert("entitlement", copy("paddle", ref))).toBeNull();
    expect((await insert("entitlement", copy("paddle", ref)))?.code).toBe(UNIQUE_VIOLATION);
    expect(await read("entitlement", ref)).toHaveLength(1);
  });

  it("the one-per-receipt rule leaves other sources, and rows without a receipt, alone", async () => {
    const ref = receipts.fresh();
    for (const source of ["another-source", "another-source"])
      expect(await insert("entitlement", copy(source, ref))).toBeNull();
    for (const source of ["paddle", "paddle"]) expect(await insert("entitlement", copy(source, null))).toBeNull();
  });

  it("an unmatched checkout keeps its receipt, a known reason and a time, once", async () => {
    const ref = receipts.fresh();
    const row = { source: "paddle", receipt_ref: ref, reason: "unknownPlayer", created_at: NOW };
    expect(await insert("checkout_unmatched", row)).toBeNull();
    expect((await insert("checkout_unmatched", row))?.code).toBe(UNIQUE_VIOLATION);
    expect(await read("checkout_unmatched", ref)).toEqual([row]);
    const other = { ...row, receipt_ref: receipts.fresh(), reason: "guessed" };
    expect((await insert("checkout_unmatched", other))?.code).toBe(CHECK_VIOLATION);
  });

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither read the new tables nor grant or revoke a receipt",
    async (who) => {
      const ref = receipts.fresh();
      await stack.service.rpc("grant_receipt", grant(ref));
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.owner.db;
      const answers = [
        await caller.from("entitlement_refund").select("*"),
        await caller.from("checkout_unmatched").select("*"),
        await caller.rpc("grant_receipt", grant(receipts.fresh())),
        await caller.rpc("revoke_receipt", { p_source: "paddle", p_receipt_ref: ref, p_now: NOW }),
      ];
      expect(answers.map((answer) => answer.error?.code)).toEqual(Array<string>(4).fill(PERMISSION_DENIED));
      expect(await read("entitlement", ref)).toHaveLength(1);
      expect(await read("entitlement_refund", ref)).toEqual([]);
    },
  );
});
