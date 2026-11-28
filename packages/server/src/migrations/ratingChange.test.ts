// The rating_change migration (supabase/migrations/20261105000000_rating_change.sql, #734). The text checks always run;
// the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an empty database
// first. commit_match's change writes are proved by the MatchStore contract (stores.contract.stack.test.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import CHANGE_MIGRATION from "../../supabase/migrations/20261105000000_rating_change.sql?raw";
import type { RatingChange } from "../ratings.ts";
import { makeUser, onLocalStack } from "../test/stack.ts";
import type { TestUser } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const COLUMNS = ["created_at", "match_id", "player", "ranked_games", "rating_after", "rating_before"];

const changeOf = (extra: Partial<RatingChange> = {}): RatingChange => ({
  match_id: `change-${freshId()}`,
  player: freshId(),
  rating_before: 1500,
  rating_after: 1662.5,
  ranked_games: 1,
  created_at: 1_700_000_000_000,
  ...extra,
});

describe("the rating_change migration's text", () => {
  it("lets every client read and none write, truncate included", () => {
    expect(CHANGE_MIGRATION).toMatch(/alter table public\.rating_change enable row level security;/);
    expect(CHANGE_MIGRATION).toMatch(/revoke all on public\.rating_change from anon, authenticated;/);
    expect(CHANGE_MIGRATION).toMatch(/grant select on public\.rating_change to anon, authenticated;/);
    expect(CHANGE_MIGRATION).not.toMatch(/grant\s+(?:insert|update|delete|truncate|all)\b[^;]*public\.rating_change/i);
    expect(CHANGE_MIGRATION).toMatch(/for select to anon, authenticated\s+using \(true\);/);
  });

  it("keeps commit_match callable by the service role only", () => {
    expect(CHANGE_MIGRATION).toMatch(
      /revoke execute on function public\.commit_match\([^)]*\) from public, anon, authenticated;/,
    );
    expect(CHANGE_MIGRATION).toMatch(/grant execute on function public\.commit_match\([^)]*\) to service_role;/);
  });
});

await onLocalStack("rating_change migration on the local Supabase stack", (keys) => {
  let service: SupabaseClient;
  let user: TestUser | undefined;
  const matches: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    user = await makeUser(keys, service, "rater");
  }, 60_000);

  afterAll(async () => {
    if (matches.length > 0) await service.from("rating_change").delete().in("match_id", matches);
    if (user) await service.auth.admin.deleteUser(user.id);
  }, 60_000);

  it("has exactly the agreed columns, and anyone reads a row, signed in or not", async () => {
    const row = changeOf();
    matches.push(row.match_id);
    expect((await service.from("rating_change").insert(row)).error).toBeNull();
    for (const db of [client(keys.url, keys.anonKey), user!.db]) {
      const read = await db.from("rating_change").select("*").eq("match_id", row.match_id);
      expect(read.error).toBeNull();
      expect(read.data).toEqual([row]);
      expect(Object.keys(read.data![0]!).sort()).toEqual(COLUMNS);
    }
  });

  it("one row per player per match", async () => {
    const row = changeOf();
    matches.push(row.match_id);
    expect((await service.from("rating_change").insert(row)).error).toBeNull();
    expect((await service.from("rating_change").insert(row)).error?.code).toBe("23505");
  });

  it("no client may insert, update or delete a row", async () => {
    const row = changeOf();
    matches.push(row.match_id);
    expect((await service.from("rating_change").insert(row)).error).toBeNull();
    for (const db of [client(keys.url, keys.anonKey), user!.db]) {
      expect((await db.from("rating_change").insert(changeOf({ player: user!.id }))).error).not.toBeNull();
      await db.from("rating_change").update({ rating_after: 3000 }).eq("match_id", row.match_id);
      await db.from("rating_change").delete().eq("match_id", row.match_id);
    }
    const read = await service.from("rating_change").select("*").eq("match_id", row.match_id);
    expect(read.data).toEqual([row]);
  });
});
