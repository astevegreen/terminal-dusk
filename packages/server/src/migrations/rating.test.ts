// The rating migration (supabase/migrations/20261102000000_rating.sql, #679). The text checks always run; the rest
// run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an empty database first.
// They prove the table's columns and checks, that anyone (signed in or not) reads every row, and that no client may
// write one. commit_match's rating writes are proved by the MatchStore contract (stores.contract.stack.test.ts). Without a running local stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import RATING_MIGRATION from "../../supabase/migrations/20261102000000_rating.sql?raw";
import type { RatingRow } from "../ratings.ts";
import { makeUser, onLocalStack } from "../test/stack.ts";
import type { TestUser } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const CHECK_VIOLATION = "23514";
const COLUMNS = [
  "deviation",
  "lio_draws",
  "lio_losses",
  "lio_wins",
  "player",
  "ranked_games",
  "rating",
  "sae_draws",
  "sae_losses",
  "sae_wins",
  "updated_at",
  "volatility",
];

const rowOf = (change: Partial<RatingRow> = {}): RatingRow => ({
  player: freshId(),
  rating: 1500,
  deviation: 350,
  volatility: 0.06,
  ranked_games: 1,
  lio_wins: 0,
  lio_losses: 0,
  lio_draws: 0,
  sae_wins: 1,
  sae_losses: 0,
  sae_draws: 0,
  updated_at: 1_700_000_000_000,
  ...change,
});

describe("the rating migration's text", () => {
  it("lets every client read and none write, truncate included", () => {
    expect(RATING_MIGRATION).toMatch(/alter table public\.rating enable row level security;/);
    expect(RATING_MIGRATION).toMatch(/revoke all on public\.rating from anon, authenticated;/);
    expect(RATING_MIGRATION).toMatch(/grant select on public\.rating to anon, authenticated;/);
    expect(RATING_MIGRATION).not.toMatch(/grant\s+(?:insert|update|delete|truncate|all)\b[^;]*public\.rating/i);
    expect(RATING_MIGRATION).toMatch(/for select to anon, authenticated\s+using \(true\);/);
  });

  it("keeps commit_match callable by the service role only", () => {
    expect(RATING_MIGRATION).toMatch(
      /revoke execute on function public\.commit_match\([^)]*\) from public, anon, authenticated;/,
    );
    expect(RATING_MIGRATION).toMatch(/grant execute on function public\.commit_match\([^)]*\) to service_role;/);
  });
});

await onLocalStack("rating migration on the local Supabase stack", (keys) => {
  let service: SupabaseClient;
  let user: TestUser | undefined;
  const players: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    user = await makeUser(keys, service, "rater");
  }, 60_000);

  afterAll(async () => {
    if (players.length > 0) await service.from("rating").delete().in("player", players);
    if (user) await service.auth.admin.deleteUser(user.id);
  }, 60_000);

  const insert = async (row: RatingRow) => {
    players.push(row.player);
    return (await service.from("rating").insert(row)).error;
  };

  it("has exactly the agreed columns, and anyone reads a row, signed in or not", async () => {
    const row = rowOf({ rating: 1662.31, deviation: 290.32 });
    expect(await insert(row)).toBeNull();
    for (const db of [client(keys.url, keys.anonKey), user!.db]) {
      const read = await db.from("rating").select("*").eq("player", row.player);
      expect(read.error).toBeNull();
      expect(read.data).toEqual([row]);
      expect(Object.keys(read.data![0]!).sort()).toEqual(COLUMNS);
    }
  });

  it.each([
    ["a rating below 0", { rating: -1 }],
    ["a deviation above 350", { deviation: 351 }],
    ["a volatility of 0", { volatility: 0 }],
    ["no ranked games", { ranked_games: 0, sae_wins: 0 }],
    ["a negative count", { lio_wins: -1, sae_wins: 2, ranked_games: 1 }],
    ["counts that do not add up to the ranked games", { ranked_games: 2 }],
  ] as const)("rejects a row with %s", async (_name, change) => {
    const row = rowOf(change);
    expect((await insert(row))?.code).toBe(CHECK_VIOLATION);
  });

  it("no client may insert, update or delete a row", async () => {
    const row = rowOf();
    expect(await insert(row)).toBeNull();
    for (const db of [client(keys.url, keys.anonKey), user!.db]) {
      const mine = rowOf({ player: user!.id });
      expect((await db.from("rating").insert(mine)).error).not.toBeNull();
      await db.from("rating").update({ rating: 3000 }).eq("player", row.player);
      await db.from("rating").delete().eq("player", row.player);
    }
    const read = await service.from("rating").select("*").eq("player", row.player);
    expect(read.data).toEqual([row]);
    expect((await service.from("rating").select("player").eq("player", user!.id)).data).toEqual([]);
  });
});
