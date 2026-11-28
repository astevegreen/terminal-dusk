// The checkout limit migration (supabase/migrations/20261103000000_checkout_attempt.sql) on the local Supabase
// stack. `pnpm test:migrations` applies every migration to an empty database first. These checks prove that no
// client may read or write checkout_attempt or run claim_checkout, and what the function does: ten calls an hour per
// player, then a refusal that records nothing; another player unaffected; the count even under racing calls; and
// calls forgotten after the hour. Without a running local stack, one test says so and how to start it.
import { afterAll, expect, it } from "vitest";
import { entitlementStack } from "../test/entitlementStack.ts";
import { onLocalStack } from "../test/stack.ts";
import { client } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const LIMIT = 10;
const PERMISSION_DENIED = "42501";

await onLocalStack("checkout limit migration on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);

  const clearPlayers = async () => {
    await stack.service.from("checkout_attempt").delete().in("player", [stack.owner.id, stack.other.id]);
  };
  afterAll(clearPlayers, 60_000);

  const claim = async (player: string, now = NOW) => {
    const { data, error } = await stack.service.rpc("claim_checkout", { p_player: player, p_now: now });
    if (error) throw new Error(`claim_checkout failed: ${error.code}`);
    return data as string;
  };
  const recorded = async (player: string) =>
    (await stack.service.from("checkout_attempt").select("attempted_at").eq("player", player)).data!.length;

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither read nor write checkout_attempt, nor run claim_checkout, and nothing changes",
    async (who) => {
      await clearPlayers();
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.other.db;
      const read = await caller.from("checkout_attempt").select("*");
      const inserted = await caller.from("checkout_attempt").insert({ player: stack.other.id, attempted_at: NOW });
      const ran = await caller.rpc("claim_checkout", { p_player: stack.other.id, p_now: NOW });
      expect([read, inserted, ran].map((answer) => answer.error?.code)).toEqual(Array(3).fill(PERMISSION_DENIED));
      expect(await recorded(stack.other.id)).toBe(0);
    },
  );

  it("ten calls in an hour are allowed and the eleventh is limited, and a limited call records nothing", async () => {
    await clearPlayers();
    for (let i = 0; i < LIMIT; i++) expect(await claim(stack.owner.id, NOW + i)).toBe("allowed");
    expect(await claim(stack.owner.id, NOW + LIMIT)).toBe("limited");
    expect(await recorded(stack.owner.id)).toBe(LIMIT);
  });

  it("the limit is per player: another player is still allowed", async () => {
    await clearPlayers();
    for (let i = 0; i < LIMIT; i++) await claim(stack.owner.id, NOW + i);
    expect(await claim(stack.owner.id, NOW + LIMIT)).toBe("limited");
    expect(await claim(stack.other.id, NOW + LIMIT)).toBe("allowed");
  });

  it("racing calls by one player cannot get past the limit", async () => {
    await clearPlayers();
    const outcomes = await Promise.all(Array.from({ length: LIMIT + 5 }, () => claim(stack.owner.id)));
    expect(outcomes.filter((o) => o === "allowed")).toHaveLength(LIMIT);
    expect(outcomes.filter((o) => o === "limited")).toHaveLength(5);
  });

  it("calls are forgotten after the hour, so the player is allowed again", async () => {
    await clearPlayers();
    for (let i = 0; i < LIMIT; i++) await claim(stack.owner.id, NOW + i);
    expect(await claim(stack.owner.id, NOW + HOUR - 1)).toBe("limited");
    expect(await claim(stack.owner.id, NOW + HOUR + LIMIT)).toBe("allowed");
  });
});
