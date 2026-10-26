// SupabaseEntitlementStore against the real entitlement table on the local Supabase stack: the same behaviour the
// stand-in client tests (supabaseEntitlementStore.test.ts) prove, and the in-memory store has.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { freshId } from "./migrations/localStack.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { entitlementStack } from "./test/entitlementStack.ts";
import { onLocalStack } from "./test/stack.ts";

const NOW = 1_700_000_000_000;

await onLocalStack("SupabaseEntitlementStore on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);

  it("gives a player with no rows an empty list", async () => {
    expect(await new SupabaseEntitlementStore(stack.service).forPlayer(stack.other.id)).toEqual([]);
  });

  it("gives only that player's platform and source, ordered by created_at then id", async () => {
    const at = (created_at: number, id: string, platform: string, source: string) => ({
      id,
      player: stack.owner.id,
      platform,
      source,
      receipt_ref: "test-receipt",
      created_at,
    });
    // Fresh ids, so a run never clashes with another's; the two rows made at the same time sort by id.
    const [low, high] = [freshId(), freshId()].toSorted();
    const rows = [
      at(NOW + 2, freshId(), "android", "third"),
      at(NOW, high!, "steam", "second"),
      at(NOW, low!, "web", "first"),
      { ...at(NOW, freshId(), "ios", "someone-else"), player: stack.other.id },
    ];
    expect((await stack.service.from("entitlement").insert(rows)).error).toBeNull();

    expect(await new SupabaseEntitlementStore(stack.service).forPlayer(stack.owner.id)).toEqual([
      { platform: "web", source: "first" },
      { platform: "steam", source: "second" },
      { platform: "android", source: "third" },
    ]);
  });
});
