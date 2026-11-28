// The unmatched-receipt grant migration (supabase/migrations/20261106000000_grant_unmatched_receipt.sql). The text
// checks always run; the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to
// an empty database first. They prove that only the service role may run grant_unmatched_receipt, and what it does:
// one copy through the normal receipt rows (so a refund still removes it), the unmatched row removed, and a double
// grant, an unknown receipt and an unknown player refused with nothing changed.
// Without a running local stack, one test says so and how to start it.
import { describe, expect, it } from "vitest";
import MIGRATION from "../../supabase/migrations/20261106000000_grant_unmatched_receipt.sql?raw";
import { entitlementStack } from "../test/entitlementStack.ts";
import { receiptRows } from "../test/receiptRows.ts";
import { onLocalStack } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";

describe("the unmatched-receipt grant migration's text", () => {
  it("lets only the service role run the function", () => {
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.grant_unmatched_receipt\(text, uuid, bigint\) from public, anon, authenticated;/,
    );
    expect(MIGRATION).toMatch(
      /grant execute on function public\.grant_unmatched_receipt\(text, uuid, bigint\) to service_role;/,
    );
    expect(MIGRATION).not.toMatch(/to (?:public|anon|authenticated)\b/);
  });

  it("grants through grant_receipt as the caller, and only the account check has definer rights", () => {
    expect(MIGRATION).toMatch(/public\.grant_receipt\(p_player, 'web', paddle, p_receipt_ref, p_now\)/);
    expect(MIGRATION.match(/security definer/g)).toHaveLength(1);
    expect(MIGRATION).toMatch(/create function public\.account_exists[^$]*security definer/);
    expect(MIGRATION.match(/set search_path = ''/g)).toHaveLength(2);
    expect(MIGRATION).toMatch(/grant execute on function public\.account_exists\(uuid\) to service_role;/);
  });
});

await onLocalStack("unmatched-receipt grant on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const receipts = receiptRows(() => stack.service);

  const unmatched = async (ref: string) => {
    const row = { source: "paddle", receipt_ref: ref, reason: "noPlayerId", created_at: NOW };
    const { error } = await stack.service.from("checkout_unmatched").insert(row);
    if (error) throw new Error(`could not put in the unmatched receipt: ${error.code}`);
  };
  const settle = async (ref: string, player: string) => {
    const { data, error } = await stack.service.rpc("grant_unmatched_receipt", {
      p_receipt_ref: ref,
      p_player: player,
      p_now: NOW,
    });
    if (error) throw new Error(`grant_unmatched_receipt failed: ${error.code}`);
    return data as string;
  };
  const copies = async (ref: string) =>
    (await stack.service.from("entitlement").select("player, platform, source").eq("receipt_ref", ref)).data;
  const waiting = async (ref: string) =>
    (await stack.service.from("checkout_unmatched").select("receipt_ref").eq("receipt_ref", ref)).data;

  it("grants the named player the web copy for that receipt and removes the unmatched row", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    expect(await settle(ref, stack.owner.id)).toBe("granted");
    expect(await copies(ref)).toEqual([{ player: stack.owner.id, platform: "web", source: "paddle" }]);
    expect(await waiting(ref)).toEqual([]);
  });

  it("a second grant of the same receipt is refused and changes nothing", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    await settle(ref, stack.owner.id);
    expect(await settle(ref, stack.other.id)).toBe("already");
    expect(await copies(ref)).toEqual([{ player: stack.owner.id, platform: "web", source: "paddle" }]);
  });

  it("a receipt that is not waiting is refused and no copy is written", async () => {
    const ref = receipts.fresh();
    expect(await settle(ref, stack.owner.id)).toBe("unknownReceipt");
    expect(await copies(ref)).toEqual([]);
  });

  it("a player id that is no account is refused, and the receipt keeps waiting", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    expect(await settle(ref, freshId())).toBe("unknownPlayer");
    expect(await copies(ref)).toEqual([]);
    expect(await waiting(ref)).toHaveLength(1);
  });

  it("a refund of the receipt still removes the copy afterwards", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    await settle(ref, stack.owner.id);
    const answer = await stack.service.rpc("revoke_receipt", {
      p_source: "paddle",
      p_receipt_ref: ref,
      p_now: NOW + 1,
    });
    expect([answer.error, answer.data]).toEqual([null, "revoked"]);
    expect(await copies(ref)).toEqual([]);
  });

  it("a receipt with an open chargeback is refused and nothing changes, so a retry with the right player works", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    const held = await stack.service.rpc("chargeback_receipt", { p_source: "paddle", p_receipt_ref: ref, p_at: NOW });
    expect(held.error).toBeNull();
    expect(await settle(ref, stack.other.id)).toBe("chargedBack");
    expect(await copies(ref)).toEqual([]);
    expect(await waiting(ref)).toHaveLength(1);
    const buyer = await stack.service.from("entitlement_chargeback").select("player").eq("receipt_ref", ref);
    expect(buyer.data).toEqual([{ player: null }]);
  });

  it("a refunded receipt is refused and nothing changes", async () => {
    const ref = receipts.fresh();
    await unmatched(ref);
    const refund = await stack.service.rpc("revoke_receipt", { p_source: "paddle", p_receipt_ref: ref, p_now: NOW });
    expect(refund.error).toBeNull();
    expect(await settle(ref, stack.owner.id)).toBe("refunded");
    expect(await copies(ref)).toEqual([]);
    expect(await waiting(ref)).toHaveLength(1);
  });

  it("only the service role can run the account check", async () => {
    const answer = await stack.other.db.rpc("account_exists", { p_player: stack.other.id });
    expect(answer.error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["signed-out client", "signed-in user"] as const)("a %s cannot run the function", async (who) => {
    const ref = receipts.fresh();
    await unmatched(ref);
    const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.other.db;
    const answer = await caller.rpc("grant_unmatched_receipt", {
      p_receipt_ref: ref,
      p_player: stack.other.id,
      p_now: NOW,
    });
    expect(answer.error?.code).toBe(PERMISSION_DENIED);
    expect(await copies(ref)).toEqual([]);
    expect(await waiting(ref)).toHaveLength(1);
  });
});
