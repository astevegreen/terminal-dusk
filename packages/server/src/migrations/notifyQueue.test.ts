// The notify_queue migration (supabase/migrations/20261024000000_notify_queue.sql). The text checks always run;
// the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to an empty
// database first. They prove the table's columns and keys, that deleting a match removes its alerts, and that
// no client may read or write the queue or run queue_turn_alerts.
// Without a running local stack, one test says so and how to start it. The rows include waiting_seq, which
// 20261025000000_notify_queue_waiting_seq.sql adds (notifyQueueWaitingSeq.test.ts).
import { describe, expect, it } from "vitest";
import NOTIFY_MIGRATION from "../../supabase/migrations/20261024000000_notify_queue.sql?raw";
import { onLocalStack } from "../test/stack.ts";
import { stackGame } from "../test/stackGame.ts";
import { client, freshId } from "./localStack.ts";

const T = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const COLUMNS = ["match_id", "player", "seq", "queued_at", "seen_seq", "sent_at", "waiting_seq"];

type Row = Record<string, unknown>;

describe("the notify_queue migration's text", () => {
  it("adds an index on notify_queue for the due query, starting with queued_at", () => {
    expect(NOTIFY_MIGRATION).toMatch(/create index \w+ on public\.notify_queue \(queued_at\b/);
  });

  it("takes every privilege on the table, and queue_turn_alerts, away from the client roles", () => {
    expect(NOTIFY_MIGRATION).toMatch(/revoke all on public\.notify_queue from anon, authenticated;/);
    expect(NOTIFY_MIGRATION).toMatch(
      /revoke execute on function public\.queue_turn_alerts\(jsonb\) from public, anon, authenticated;/,
    );
  });

  it("grants clients nothing and adds no policy", () => {
    expect(NOTIFY_MIGRATION).not.toMatch(
      /\bgrant\b(?!\s+execute on function public\.queue_turn_alerts\(jsonb\) to service_role;)/i,
    );
    expect(NOTIFY_MIGRATION).not.toMatch(/create policy/i);
  });
});

await onLocalStack("notify_queue migration on the local Supabase stack", (keys) => {
  const game = stackGame(keys);
  const rowFor = (matchId: string, change: Row = {}): Row => ({
    match_id: matchId,
    player: game.users[0]!.id,
    seq: 2,
    queued_at: T,
    seen_seq: null,
    sent_at: null,
    waiting_seq: 2,
    ...change,
  });
  const readQueue = async (matchId: string) =>
    (await game.service.from("notify_queue").select("*").eq("match_id", matchId).order("player")).data;

  it("has exactly the agreed columns, keeps whole-number millisecond times, and lets seen_seq and sent_at be null", async () => {
    const matchId = (await game.stored()).record.matchId;
    const fresh = rowFor(matchId);
    const done = rowFor(matchId, { player: game.users[1]!.id, seen_seq: 3, sent_at: T + 5 });
    expect((await game.service.from("notify_queue").insert([fresh, done])).error).toBeNull();
    const read = await readQueue(matchId);
    expect(read).toHaveLength(2);
    expect(Object.keys(read![0]!).toSorted()).toEqual(COLUMNS.toSorted());
    const byPlayer = (rows: Row[]) => rows.toSorted((a, b) => String(a.player).localeCompare(String(b.player)));
    expect(byPlayer(read!)).toEqual(byPlayer([fresh, done]));
  }, 60_000);

  it("keeps one row per match and player: a second row for the same pair is refused", async () => {
    const matchId = (await game.stored()).record.matchId;
    expect((await game.service.from("notify_queue").insert(rowFor(matchId))).error).toBeNull();
    const again = await game.service.from("notify_queue").insert(rowFor(matchId, { seq: 3 }));
    expect(again.error?.code).toBe(UNIQUE_VIOLATION);
    expect(await readQueue(matchId)).toEqual([rowFor(matchId)]);
  }, 60_000);

  it("refuses an alert for a match that does not exist", async () => {
    const matchId = `test-${freshId()}`;
    const { error } = await game.service.from("notify_queue").insert(rowFor(matchId));
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    expect(await readQueue(matchId)).toEqual([]);
  }, 60_000);

  it("deleting a match removes its alerts", async () => {
    const matchId = (await game.stored()).record.matchId;
    expect((await game.service.from("notify_queue").insert(rowFor(matchId))).error).toBeNull();
    expect((await game.service.from("match").delete().eq("match_id", matchId)).error).toBeNull();
    expect(await readQueue(matchId)).toEqual([]);
  }, 60_000);

  it.each(["signed-out client", "signed-in player"] as const)(
    "a %s can neither read nor write notify_queue, and a re-read with the service role shows nothing changed",
    async (who) => {
      const matchId = (await game.stored()).record.matchId;
      const row = rowFor(matchId);
      expect((await game.service.from("notify_queue").insert(row)).error).toBeNull();
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : game.users[0]!.db;

      const read = await caller.from("notify_queue").select("*").eq("match_id", matchId);
      const inserted = await caller.from("notify_queue").insert(rowFor(matchId, { player: game.users[1]!.id }));
      const updated = await caller.from("notify_queue").update({ seen_seq: 2 }).eq("match_id", matchId);
      const deleted = await caller.from("notify_queue").delete().eq("match_id", matchId);
      expect(read.data).toBeNull();
      expect([read, inserted, updated, deleted].map((answer) => answer.error?.code)).toEqual([
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
      ]);
      expect(await readQueue(matchId)).toEqual([row]);
    },
    60_000,
  );

  it.each(["signed-out client", "signed-in player"] as const)(
    "a %s may not run queue_turn_alerts, and a re-read with the service role shows nothing changed",
    async (who) => {
      const matchId = (await game.stored()).record.matchId;
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : game.users[0]!.db;
      const p_alerts = [{ match_id: matchId, player: game.users[0]!.id, seq: 1, queued_at: T }];
      const { data, error } = await caller.rpc("queue_turn_alerts", { p_alerts });
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(await readQueue(matchId)).toEqual([]);
    },
    60_000,
  );
});
