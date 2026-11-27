// The chargeback migration (#683) on the local Supabase stack. `pnpm test:migrations` applies every migration to an
// empty database first. What a chargeback and its reversal do is checked by the EntitlementReceipts contract
// (stores.contract.stack.test.ts); here: the new table's columns and checks, where the buyer is held meanwhile, and
// that no client can read the table or run the two functions.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { entitlementStack } from "../test/entitlementStack.ts";
import { receiptRows } from "../test/receiptRows.ts";
import { onLocalStack } from "../test/stack.ts";
import { client } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const AT = 1_699_000_000_000;
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";

await onLocalStack("chargebacks migration on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const receipts = receiptRows(() => stack.service);
  const call = async (name: string, args: Record<string, unknown>) => {
    const answer = await stack.service.rpc(name, args);
    return [answer.error, answer.data];
  };
  const read = async (table: string, ref: string) =>
    (await stack.service.from(table).select("*").eq("receipt_ref", ref)).data;
  const receipt = (ref: string) => ({ p_source: "paddle", p_receipt_ref: ref });
  const grant = (ref: string) => ({ ...receipt(ref), p_player: stack.owner.id, p_platform: "web", p_now: NOW });
  const charge = (ref: string, at = AT) => ({ ...receipt(ref), p_at: at });
  const reverse = (ref: string, at = AT + 1) => ({ ...receipt(ref), p_at: at, p_now: NOW + 5 });
  const held = (ref: string, over: Record<string, unknown>) => ({
    source: "paddle",
    receipt_ref: ref,
    charged_back_at: AT,
    reversed_at: 0,
    player: null,
    platform: null,
    ...over,
  });

  it("chargeback_receipt removes the entitlement and holds its buyer", async () => {
    const ref = receipts.fresh();
    await stack.service.rpc("grant_receipt", grant(ref));
    expect(await call("chargeback_receipt", charge(ref))).toEqual([null, "revoked"]);
    expect(await read("entitlement", ref)).toEqual([]);
    const buyer = { player: stack.owner.id, platform: "web" };
    expect(await read("entitlement_chargeback", ref)).toEqual([held(ref, buyer)]);
  });

  it("reverse_chargeback writes the entitlement again, dated now, and holds nobody", async () => {
    const ref = receipts.fresh();
    await stack.service.rpc("grant_receipt", grant(ref));
    await stack.service.rpc("chargeback_receipt", charge(ref));
    expect(await call("reverse_chargeback", reverse(ref))).toEqual([null, "restored"]);
    expect(await read("entitlement", ref)).toEqual([
      {
        id: expect.any(String),
        player: stack.owner.id,
        platform: "web",
        source: "paddle",
        receipt_ref: ref,
        created_at: NOW + 5,
      },
    ]);
    expect(await read("entitlement_chargeback", ref)).toEqual([held(ref, { reversed_at: AT + 1 })]);
  });

  it("each time keeps its latest value, whatever order they arrive in", async () => {
    const ref = receipts.fresh();
    await stack.service.rpc("reverse_chargeback", reverse(ref, AT + 10));
    await stack.service.rpc("reverse_chargeback", reverse(ref, AT + 5));
    await stack.service.rpc("chargeback_receipt", charge(ref, AT + 3));
    await stack.service.rpc("chargeback_receipt", charge(ref, AT + 1));
    const times = { charged_back_at: AT + 3, reversed_at: AT + 10 };
    expect(await read("entitlement_chargeback", ref)).toEqual([held(ref, times)]);
  });

  it("a held buyer has both a player and a platform, or neither", async () => {
    for (const half of [{ player: stack.owner.id }, { platform: "web" }]) {
      const row = held(receipts.fresh(), half);
      const { error } = await stack.service.from("entitlement_chargeback").insert(row);
      expect(error?.code).toBe(CHECK_VIOLATION);
    }
  });

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither read the table nor charge back or reverse a receipt",
    async (who) => {
      const ref = receipts.fresh();
      await stack.service.rpc("grant_receipt", grant(ref));
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.owner.db;
      const answers = [
        await caller.from("entitlement_chargeback").select("*"),
        await caller.rpc("chargeback_receipt", charge(ref)),
        await caller.rpc("reverse_chargeback", reverse(ref)),
        await caller.rpc("grant_receipt", grant(receipts.fresh())),
      ];
      expect(answers.map((answer) => answer.error?.code)).toEqual(Array<string>(4).fill(PERMISSION_DENIED));
      expect(await read("entitlement", ref)).toHaveLength(1);
      expect(await read("entitlement_chargeback", ref)).toEqual([]);
    },
  );
});
