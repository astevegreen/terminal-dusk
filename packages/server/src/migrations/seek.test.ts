// The matchmaking migration (supabase/migrations/20261104000000_seek.sql, #681). The text checks always run; the rest
// run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an empty database first.
// They prove the table's checks, that a player reads only their own tickets and no client writes one, the limit of 5,
// that pairing is atomic and safe to run twice, and that the matchmake job runs every minute. Without a running local
// stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostCreate } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import SEEK_MIGRATION from "../../supabase/migrations/20261104000000_seek.sql?raw";
import PLATFORM_MIGRATION from "../../supabase/migrations/20261107000000_seek_platform.sql?raw";
import { RANKED_LIMIT } from "../matchmake.ts";
import { SupabaseSeekStore } from "../supabaseSeekStore.ts";
import { makeUser, onLocalStack } from "../test/stack.ts";
import type { TestUser } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

describe("the matchmaking migration's text", () => {
  it("only the service role may run create_seek, pair_seeks and matchmake_job", () => {
    for (const fn of ["public.pair_seeks(uuid, uuid, jsonb, jsonb, jsonb, jsonb)", "public.matchmake_job()"]) {
      expect(SEEK_MIGRATION).toContain(`revoke execute on function ${fn} from public, anon, authenticated;`);
      expect(SEEK_MIGRATION).toContain(`grant execute on function ${fn} to service_role;`);
    }
    const fn = "public.create_seek(uuid, uuid, integer, text, text, bigint, integer, text)";
    expect(PLATFORM_MIGRATION).toContain(`revoke execute on function ${fn} from public, anon, authenticated;`);
    expect(PLATFORM_MIGRATION).toContain(`grant execute on function ${fn} to service_role;`);
  });

  it("the platform migration replaces the old create_seek and checks the platform name", () => {
    expect(PLATFORM_MIGRATION).toContain(
      "drop function public.create_seek(uuid, uuid, integer, text, text, bigint, integer);",
    );
    expect(PLATFORM_MIGRATION).toContain("check (platform in ('web', 'steam', 'ios', 'android'))");
    expect(PLATFORM_MIGRATION).toContain("alter column platform drop default");
  });

  it("schedules the matchmake job by name every minute with a call_sweep command", () => {
    expect(SEEK_MIGRATION).toContain(
      "select cron.schedule('matchmake', '* * * * *', $$select public.call_sweep('matchmake')$$);",
    );
  });

  it("gives clients only a read of their own tickets and no write privilege", () => {
    expect(SEEK_MIGRATION).toContain("revoke all on public.seek from anon, authenticated;");
    expect(SEEK_MIGRATION).toContain("grant select on public.seek to authenticated;");
    expect(SEEK_MIGRATION).toContain("using (player = auth.uid())");
    const grants = SEEK_MIGRATION.match(/^\s*grant\b.*$/gim) ?? [];
    expect(grants.every((line) => /(select on public\.seek to authenticated|to service_role);\s*$/.test(line))).toBe(
      true,
    );
  });

  it("writes no literal url or key", () => {
    expect(SEEK_MIGRATION).not.toMatch(/https?:\/\//i);
    expect(SEEK_MIGRATION).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

await onLocalStack("matchmaking migration on the local Supabase stack", (keys) => {
  let service: SupabaseClient;
  let user: TestUser | undefined;
  const players: string[] = [];
  const matchIds: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    user = await makeUser(keys, service, "seeker");
  }, 60_000);

  afterAll(async () => {
    if (players.length > 0) await service.from("seek").delete().in("player", players);
    if (matchIds.length > 0) await service.from("match").delete().in("match_id", matchIds);
    if (user) await service.auth.admin.deleteUser(user.id);
  }, 60_000);

  const args = (player: string, over: Record<string, unknown> = {}) => {
    players.push(player);
    return {
      p_id: freshId(),
      p_player: player,
      p_rating: 1500,
      p_preset: "normal",
      p_side: null,
      p_created_at: 1_700_000_000_000,
      p_limit: RANKED_LIMIT,
      p_platform: "web",
      ...over,
    };
  };

  it("create_seek stores tickets up to the limit and then answers 'limit'", async () => {
    const player = freshId();
    for (let n = 0; n < RANKED_LIMIT; n++) {
      expect((await service.rpc("create_seek", args(player))).data).toBe("saved");
    }
    expect((await service.rpc("create_seek", args(player))).data).toBe("limit");
    const rows = await service.from("seek").select("id").eq("player", player);
    expect(rows.data).toHaveLength(RANKED_LIMIT);
  }, 60_000);

  it.each([
    ["an unknown preset", { p_preset: "turbo" }],
    ["an unknown side", { p_side: "mid" }],
    ["an unknown platform", { p_platform: "playstation" }],
  ] as const)(
    "rejects a ticket with %s",
    async (_name, change) => {
      const { error } = await service.rpc("create_seek", args(freshId(), change));
      expect(error?.code).toBe(CHECK_VIOLATION);
    },
    60_000,
  );

  it("a player reads only their own tickets, and no client may write one", async () => {
    const mine = args(user!.id);
    expect((await service.rpc("create_seek", mine)).data).toBe("saved");
    expect((await service.rpc("create_seek", args(freshId()))).data).toBe("saved");
    const read = await user!.db.from("seek").select("id, player");
    expect(read.error).toBeNull();
    expect(read.data).toEqual([{ id: mine.p_id, player: user!.id }]);
    const anon = client(keys.url, keys.anonKey);
    expect((await anon.from("seek").select("id")).error?.code).toBe(PERMISSION_DENIED);
    expect(
      (
        await user!.db.from("seek").insert({
          id: freshId(),
          player: user!.id,
          rating: 1500,
          preset: "normal",
          side: null,
          created_at: 0,
          platform: "web",
        })
      ).error?.code,
    ).toBe(PERMISSION_DENIED);
    expect((await user!.db.rpc("create_seek", args(user!.id))).error?.code).toBe(PERMISSION_DENIED);
  }, 60_000);

  it("pair_seeks makes a ranked match and removes both tickets, and run again it pairs nothing", async () => {
    const [first, second] = [freshId(), freshId()];
    const a = args(first);
    const b = args(second);
    expect((await service.rpc("create_seek", a)).data).toBe("saved");
    expect((await service.rpc("create_seek", b)).data).toBe("saved");
    const matchId = freshId();
    matchIds.push(matchId);
    const config = { matchId, players: { lio: first, sae: second }, setup: firstDeckConfig().setup };
    const created = hostCreate(firstDeckRuleset, config, "seed-for-seek-test", 1_700_000_000_000);
    if (!created.ok) throw new Error("hostCreate refused");
    const { record, secret, frames } = created.value;
    const write = { record: { ...record, ranked: true as const }, secret, frames };
    const store = new SupabaseSeekStore(service);
    expect(await store.pair([a.p_id, b.p_id], write)).toBe("paired");
    const left = await service.from("seek").select("id").in("id", [a.p_id, b.p_id]);
    expect(left.data).toEqual([]);
    const row = await service.from("match").select("ranked").eq("match_id", matchId).single();
    expect(row.data).toEqual({ ranked: true });
    expect(await store.pair([a.p_id, b.p_id], write)).toBe("unavailable");
  }, 60_000);

  it("a missing ticket leaves the other ticket and writes no match", async () => {
    const a = args(freshId());
    expect((await service.rpc("create_seek", a)).data).toBe("saved");
    const matchId = freshId();
    matchIds.push(matchId);
    const config = { matchId, players: { lio: a.p_player, sae: freshId() }, setup: firstDeckConfig().setup };
    const created = hostCreate(firstDeckRuleset, config, "seed-for-seek-test-2", 1_700_000_000_000);
    if (!created.ok) throw new Error("hostCreate refused");
    const { record, secret, frames } = created.value;
    const write = { record, secret, frames };
    expect(await new SupabaseSeekStore(service).pair([a.p_id, freshId()], write)).toBe("unavailable");
    expect((await service.from("seek").select("id").eq("id", a.p_id)).data).toHaveLength(1);
    expect((await service.from("match").select("match_id").eq("match_id", matchId)).data).toEqual([]);
  }, 60_000);

  it("the matchmake job runs every minute and clients may not read it", async () => {
    const { data, error } = await service.rpc("matchmake_job");
    expect(error).toBeNull();
    expect(data).toEqual([
      { jobname: "matchmake", schedule: "* * * * *", command: "select public.call_sweep('matchmake')" },
    ]);
    const anon = client(keys.url, keys.anonKey);
    expect((await anon.rpc("matchmake_job")).error?.code).toBe(PERMISSION_DENIED);
    expect((await service.rpc("call_sweep", { p_function: "matchmake" })).data).toBe("unconfigured");
  }, 60_000);
});
