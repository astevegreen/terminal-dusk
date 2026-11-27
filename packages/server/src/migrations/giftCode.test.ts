// The gift code migration (supabase/migrations/20261031000000_gift_code.sql) on the local Supabase stack.
// `pnpm test:migrations` applies every migration to an empty database first. These checks prove the tables'
// columns and checks, that no client may read or write either table or run redeem_gift_code, and what the
// function does: one grant per code, even to racing callers; the wrong-guess limit; and a code left unused when its
// caller already owns the platform. Without a running local stack, one test says so and how to start it.
import { afterAll, expect, it } from "vitest";
import { entitlementStack } from "../test/entitlementStack.ts";
import { onLocalStack } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const COLUMNS = ["code_hash", "platform", "created_at", "redeemed_by", "redeemed_at"];

/** A hash no other run or test uses: 64 lowercase hex characters. */
const freshHash = (): string => `${freshId()}${freshId()}`.replaceAll("-", "");

await onLocalStack("gift code migration on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const hashes: string[] = [];

  afterAll(async () => {
    const service = client(keys.url, keys.serviceKey);
    if (hashes.length > 0) await service.from("gift_code").delete().in("code_hash", hashes);
    await service.from("gift_code_attempt").delete().in("player", [stack.owner.id, stack.other.id]);
  }, 60_000);

  /** Stores a new unused code for `platform` and returns its hash. */
  const stored = async (platform = "web"): Promise<string> => {
    const hash = freshHash();
    hashes.push(hash);
    const { error } = await stack.service.from("gift_code").insert({ code_hash: hash, platform, created_at: NOW });
    if (error) throw new Error(`could not store the test code: ${error.code}`);
    return hash;
  };
  const redeem = async (hash: string, player: string, now = NOW) => {
    const { data, error } = await stack.service.rpc("redeem_gift_code", { p_hash: hash, p_player: player, p_now: now });
    if (error) throw new Error(`redeem_gift_code failed: ${error.code}`);
    return data as string;
  };
  const codeRow = async (hash: string) =>
    (await stack.service.from("gift_code").select("*").eq("code_hash", hash)).data![0];
  const entitlements = async (player: string) =>
    (await stack.service.from("entitlement").select("platform, source").eq("player", player)).data;
  const clearPlayer = async (player: string) => {
    await stack.service.from("entitlement").delete().eq("player", player);
    await stack.service.from("gift_code_attempt").delete().eq("player", player);
  };

  it("has exactly the agreed columns: a code starts unused", async () => {
    const hash = await stored();
    const row = await codeRow(hash);
    expect(Object.keys(row!).toSorted()).toEqual(COLUMNS.toSorted());
    expect(row).toEqual({ code_hash: hash, platform: "web", created_at: NOW, redeemed_by: null, redeemed_at: null });
  });

  it.each([
    ["a hash that is not 64 lowercase hex characters", { code_hash: "ABCDEF".padEnd(64, "0") }],
    ["a plain code instead of a hash", { code_hash: "ABCDEFGHJKMNPQRSTUVW" }],
    ["an unknown platform", { platform: "switch" }],
    ["a redeemer without a time", { redeemed_by: "00000000-0000-4000-8000-000000000001" }],
    ["a redeem time without a redeemer", { redeemed_at: NOW }],
  ] as const)("rejects a code row with %s", async (_name, change) => {
    const row = { code_hash: freshHash(), platform: "web", created_at: NOW, ...change };
    hashes.push(row.code_hash);
    expect((await stack.service.from("gift_code").insert(row)).error?.code).toBe(CHECK_VIOLATION);
  });

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither read nor write either table, nor run redeem_gift_code, and nothing changes",
    async (who) => {
      const hash = await stored();
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.other.db;
      for (const table of ["gift_code", "gift_code_attempt"]) {
        const read = await caller.from(table).select("*");
        expect(read.error?.code, `${who} reading ${table}`).toBe(PERMISSION_DENIED);
      }
      const inserted = await caller
        .from("gift_code")
        .insert({ code_hash: freshHash(), platform: "web", created_at: NOW });
      const updated = await caller.from("gift_code").update({ platform: "steam" }).eq("code_hash", hash);
      const deleted = await caller.from("gift_code").delete().eq("code_hash", hash);
      const attempt = await caller.from("gift_code_attempt").insert({ player: stack.other.id, attempted_at: NOW });
      const ran = await caller.rpc("redeem_gift_code", { p_hash: hash, p_player: stack.other.id, p_now: NOW });
      expect([inserted, updated, deleted, attempt, ran].map((answer) => answer.error?.code)).toEqual(
        Array(5).fill(PERMISSION_DENIED),
      );
      expect((await codeRow(hash))?.redeemed_by).toBeNull();
      expect(await entitlements(stack.other.id)).toEqual([]);
    },
  );

  it("a good code grants one entitlement for its platform, with source 'gift code', and is marked redeemed", async () => {
    await clearPlayer(stack.owner.id);
    const hash = await stored("steam");
    expect(await redeem(hash, stack.owner.id)).toBe("redeemed");
    expect(await entitlements(stack.owner.id)).toEqual([{ platform: "steam", source: "gift code" }]);
    expect(await codeRow(hash)).toMatchObject({ redeemed_by: stack.owner.id, redeemed_at: NOW });
  });

  it("the same code twice by its redeemer grants once; by anyone else it is used and counts as a wrong guess", async () => {
    await clearPlayer(stack.owner.id);
    await clearPlayer(stack.other.id);
    const hash = await stored();
    expect(await redeem(hash, stack.owner.id)).toBe("redeemed");
    expect(await redeem(hash, stack.owner.id)).toBe("alreadyYours");
    expect(await redeem(hash, stack.other.id)).toBe("used");
    expect(await entitlements(stack.owner.id)).toEqual([{ platform: "web", source: "gift code" }]);
    expect(await entitlements(stack.other.id)).toEqual([]);
    const attempts = await stack.service.from("gift_code_attempt").select("player");
    expect(attempts.data!.filter((a) => a.player === stack.owner.id)).toEqual([]);
    expect(attempts.data!.filter((a) => a.player === stack.other.id)).toHaveLength(1);
  });

  it("two players racing for one code: exactly one gets it", async () => {
    await clearPlayer(stack.owner.id);
    await clearPlayer(stack.other.id);
    const hash = await stored();
    const outcomes = await Promise.all([redeem(hash, stack.owner.id), redeem(hash, stack.other.id)]);
    expect(outcomes.toSorted()).toEqual(["redeemed", "used"]);
    const granted = [...(await entitlements(stack.owner.id))!, ...(await entitlements(stack.other.id))!];
    expect(granted).toEqual([{ platform: "web", source: "gift code" }]);
  });

  it("one player racing two web codes gets one copy; the other code stays unused", async () => {
    await clearPlayer(stack.owner.id);
    const [first, second] = [await stored(), await stored()];
    const outcomes = await Promise.all([redeem(first, stack.owner.id), redeem(second, stack.owner.id)]);
    expect(outcomes.toSorted()).toEqual(["owned", "redeemed"]);
    expect(await entitlements(stack.owner.id)).toEqual([{ platform: "web", source: "gift code" }]);
    const unused = [await codeRow(first), await codeRow(second)].filter((row) => row?.redeemed_by === null);
    expect(unused).toHaveLength(1);
  });

  it("a player who owns the platform is told so; the code stays unused for someone else", async () => {
    await clearPlayer(stack.owner.id);
    await clearPlayer(stack.other.id);
    await stack.service
      .from("entitlement")
      .insert({ player: stack.owner.id, platform: "web", source: "test-store", created_at: NOW });
    const hash = await stored();
    expect(await redeem(hash, stack.owner.id)).toBe("owned");
    expect((await codeRow(hash))?.redeemed_by).toBeNull();
    expect(await redeem(hash, stack.other.id)).toBe("redeemed");
  });

  it("an unknown code writes no entitlement, only a wrong guess", async () => {
    await clearPlayer(stack.other.id);
    expect(await redeem(freshHash(), stack.other.id)).toBe("unknown");
    expect(await entitlements(stack.other.id)).toEqual([]);
  });

  it("after ten wrong guesses in an hour even a good code is refused, until the hour has passed", async () => {
    await clearPlayer(stack.other.id);
    for (let i = 0; i < 10; i++) expect(await redeem(freshHash(), stack.other.id, NOW + i)).toBe("unknown");
    const hash = await stored();
    expect(await redeem(hash, stack.other.id, NOW + 10)).toBe("limited");
    expect((await codeRow(hash))?.redeemed_by).toBeNull();
    expect(await redeem(hash, stack.other.id, NOW + HOUR - 1)).toBe("limited");
    expect(await redeem(hash, stack.other.id, NOW + HOUR + 9)).toBe("redeemed");
  });
});
