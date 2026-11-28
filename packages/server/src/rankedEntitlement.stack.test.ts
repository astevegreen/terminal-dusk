// #687 on the local Supabase stack: a ranked search (createSeek over the real tables) is refused for a player with no
// Full Game and stores no ticket; the matchmake sweep then refuses to pair a ticket whose player has no Full Game.
// Without a running local stack, one test says so and how to start it.
import { afterAll, expect, it } from "vitest";
import { freshId } from "./migrations/localStack.ts";
import { createSeek, matchmake } from "./matchmake.ts";
import type { MatchmakeDeps } from "./matchmake.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseSeekStore } from "./supabaseSeekStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { onLocalStack } from "./test/stack.ts";

const NOW = 1_700_000_000_000;

await onLocalStack("a ranked search on the local Supabase stack needs the Full Game (#687)", (keys) => {
  const stack = inviteStack(keys);
  const tickets: string[] = [];
  afterAll(async () => {
    if (tickets.length > 0) await stack.service.from("seek").delete().in("id", tickets);
  });
  const search = (player: string) => {
    const ticketId = freshId();
    tickets.push(ticketId);
    const deps = {
      seeks: new SupabaseSeekStore(stack.service),
      entitlements: new SupabaseEntitlementStore(stack.service),
      matches: new SupabaseStore(stack.service),
      ticketId: () => ticketId,
    };
    return { ticketId, made: createSeek(deps, { player, platform: "web", preset: "normal", now: NOW }) };
  };
  const stored = async (id: string) => (await stack.service.from("seek").select("id").eq("id", id)).data?.length ?? 0;

  it("a player with no entitlement is refused notEntitled and no ticket is stored", async () => {
    const { ticketId, made } = search(stack.joiner.id);
    expect(await made).toEqual({ ok: false, error: { code: "notEntitled", message: expect.any(String) } });
    expect(await stored(ticketId)).toBe(0);
  });

  it("a player who owns the Full Game on the platform gets a ticket", async () => {
    const { ticketId, made } = search(stack.host.id);
    expect(await made).toEqual({ ok: true, value: { ticketId } });
    expect(await stored(ticketId)).toBe(1);
  });

  it("the sweep does not pair a ticket whose player has no Full Game", async () => {
    const owner = search(stack.host.id);
    expect((await owner.made).ok).toBe(true);
    const freeId = freshId();
    tickets.push(freeId);
    // A ticket stored while the player owned the game (as a refund or chargeback can leave it): the player has none now.
    const inserted = await stack.service
      .from("seek")
      .insert({ id: freeId, player: stack.third.id, rating: 1500, preset: "normal", side: null, created_at: NOW });
    expect(inserted.error).toBeNull();
    const deps: MatchmakeDeps = {
      seeks: new SupabaseSeekStore(stack.service),
      entitlements: new SupabaseEntitlementStore(stack.service),
      matchId: () => stack.matchId(),
      seed: () => "ranked-entitlement-stack-seed",
      notify: undefined,
    };
    await matchmake(deps, NOW);
    expect(await stored(freeId)).toBe(1);
  }, 60_000);
});
