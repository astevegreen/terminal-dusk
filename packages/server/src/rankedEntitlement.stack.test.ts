// #687 on the local Supabase stack: a ranked search (createSeek over the real tables) is refused for a player with no
// Full Game and stores no ticket; the matchmake sweep then refuses to pair a ticket whose player has no Full Game on
// the ticket's platform, and does pair two players who own it. The sweep sees only this file's own tickets, and each
// test removes its tickets and any entitlement it added. Without a running local stack, one test says so.
import { afterEach, expect, it } from "vitest";
import { freshId } from "./migrations/localStack.ts";
import { createSeek, matchmake } from "./matchmake.ts";
import type { MatchmakeDeps } from "./matchmake.ts";
import type { SeekStore } from "./seekStore.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { SupabaseSeekStore } from "./supabaseSeekStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { onLocalStack } from "./test/stack.ts";

const NOW = 1_700_000_000_000;

await onLocalStack("a ranked search on the local Supabase stack needs the Full Game (#687)", (keys) => {
  const stack = inviteStack(keys);
  const tickets: string[] = [];
  const entitled: string[] = [];
  afterEach(async () => {
    if (tickets.length > 0) await stack.service.from("seek").delete().in("id", tickets);
    if (entitled.length > 0) await stack.service.from("entitlement").delete().in("player", entitled);
    tickets.length = 0;
    entitled.length = 0;
  });
  /** The real seek store, but a sweep through it sees only the tickets this test made. */
  const ownTickets = (): SeekStore => {
    const real = new SupabaseSeekStore(stack.service);
    return {
      create: (ticket, limit) => real.create(ticket, limit),
      cancel: (id, player) => real.cancel(id, player),
      open: async () => (await real.open()).filter((ticket) => tickets.includes(ticket.id)),
      pair: (ids, write) => real.pair(ids, write),
    };
  };
  const search = (player: string, platform: "web" | "steam" = "web") => {
    const ticketId = freshId();
    tickets.push(ticketId);
    const deps = {
      seeks: new SupabaseSeekStore(stack.service),
      entitlements: new SupabaseEntitlementStore(stack.service),
      matches: new SupabaseStore(stack.service),
      ticketId: () => ticketId,
    };
    return { ticketId, made: createSeek(deps, { player, platform, preset: "normal", now: NOW }) };
  };
  const stored = async (id: string) => (await stack.service.from("seek").select("id").eq("id", id)).data?.length ?? 0;
  const grant = async (player: string, platform: "web" | "steam") => {
    entitled.push(player);
    const done = await stack.service.from("entitlement").insert({ player, platform, source: "test", created_at: 0 });
    expect(done.error).toBeNull();
  };
  /** A ticket stored directly, as one left from before a refund or chargeback. */
  const insertTicket = async (player: string, platform: "web" | "steam") => {
    const id = freshId();
    tickets.push(id);
    const inserted = await stack.service
      .from("seek")
      .insert({ id, player, rating: 1500, preset: "normal", side: null, created_at: NOW, platform });
    expect(inserted.error).toBeNull();
    return id;
  };
  const sweep = () => {
    const deps: MatchmakeDeps = {
      seeks: ownTickets(),
      entitlements: new SupabaseEntitlementStore(stack.service),
      matchId: () => stack.matchId(),
      seed: () => "ranked-entitlement-stack-seed",
      notify: undefined,
    };
    return matchmake(deps, NOW);
  };

  it("a player with no entitlement is refused notEntitled and no ticket is stored", async () => {
    const { ticketId, made } = search(stack.joiner.id);
    expect(await made).toEqual({ ok: false, error: { code: "notEntitled", message: expect.any(String) } });
    expect(await stored(ticketId)).toBe(0);
  });

  it("a player who owns the Full Game on the platform gets a ticket that records the platform", async () => {
    const { ticketId, made } = search(stack.host.id);
    expect(await made).toEqual({ ok: true, value: { ticketId } });
    expect(await stored(ticketId)).toBe(1);
    const row = await stack.service.from("seek").select("platform").eq("id", ticketId).single();
    expect(row.data).toEqual({ platform: "web" });
  });

  it("the sweep does not pair a ticket whose player has no Full Game", async () => {
    const owner = search(stack.host.id);
    expect((await owner.made).ok).toBe(true);
    // A ticket stored while the player owned the game (as a refund or chargeback can leave it): the player has none now.
    const freeId = await insertTicket(stack.third.id, "web");
    expect(await sweep()).toEqual([]);
    expect(await stored(freeId)).toBe(1);
    expect(await stored(owner.ticketId)).toBe(1);
  }, 60_000);

  it("the sweep does not pair a ticket whose player owns the Full Game only on another platform", async () => {
    const owner = search(stack.host.id);
    expect((await owner.made).ok).toBe(true);
    await grant(stack.joiner.id, "steam");
    const webId = await insertTicket(stack.joiner.id, "web");
    expect(await sweep()).toEqual([]);
    expect(await stored(webId)).toBe(1);
    expect(await stored(owner.ticketId)).toBe(1);
  }, 60_000);

  it("the sweep pairs two players who each own the Full Game on their platform", async () => {
    const first = search(stack.host.id);
    expect((await first.made).ok).toBe(true);
    await grant(stack.joiner.id, "web");
    const secondId = await insertTicket(stack.joiner.id, "web");
    const results = await sweep();
    expect(results).toEqual([{ status: "paired", matchId: expect.any(String) }]);
    expect(await stored(first.ticketId)).toBe(0);
    expect(await stored(secondId)).toBe(0);
  }, 60_000);
});
