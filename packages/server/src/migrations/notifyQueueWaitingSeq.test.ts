// The waiting_seq migration (supabase/migrations/20261025000000_notify_queue_waiting_seq.sql). The text checks
// always run; the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration to
// an empty database first. They prove waiting_seq is required, that queue_turn_alerts sets it to the alert's seq
// on insert and on replace, and that clients still may not run queue_turn_alerts.
// Without a running local stack, one test says so and how to start it.
import { describe, expect, it } from "vitest";
import WAITING_MIGRATION from "../../supabase/migrations/20261025000000_notify_queue_waiting_seq.sql?raw";
import { onLocalStack } from "../test/stack.ts";
import { stackGame } from "../test/stackGame.ts";
import { client } from "./localStack.ts";

const T = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const NOT_NULL_VIOLATION = "23502";

describe("the waiting_seq migration's text", () => {
  it("adds waiting_seq to notify_queue, fills it from seq, then makes it required", () => {
    const add = WAITING_MIGRATION.search(/alter table public\.notify_queue add column waiting_seq integer;/);
    const fill = WAITING_MIGRATION.search(/update public\.notify_queue set waiting_seq = seq;/);
    const required = WAITING_MIGRATION.search(
      /alter table public\.notify_queue alter column waiting_seq set not null;/,
    );
    expect([add, fill, required].every((at) => at >= 0)).toBe(true);
    expect(add < fill && fill < required).toBe(true);
  });

  it("queue_turn_alerts sets waiting_seq to the alert's seq on insert and on replace", () => {
    expect(WAITING_MIGRATION).toMatch(/create or replace function public\.queue_turn_alerts\(p_alerts jsonb\)/);
    expect(WAITING_MIGRATION).toMatch(/values \(a\.match_id, a\.player, a\.seq, a\.queued_at, null, null, a\.seq\)/);
    expect(WAITING_MIGRATION).toMatch(/waiting_seq = excluded\.seq\s+where q\.seq < excluded\.seq;/);
  });

  it("keeps queue_turn_alerts for the service role only, grants clients nothing and adds no policy", () => {
    expect(WAITING_MIGRATION).toMatch(
      /revoke execute on function public\.queue_turn_alerts\(jsonb\) from public, anon, authenticated;/,
    );
    expect(WAITING_MIGRATION).toMatch(/grant execute on function public\.queue_turn_alerts\(jsonb\) to service_role;/);
    expect(WAITING_MIGRATION).not.toMatch(
      /\bgrant\b(?!\s+execute on function public\.queue_turn_alerts\(jsonb\) to service_role;)/i,
    );
    expect(WAITING_MIGRATION).not.toMatch(/create policy/i);
  });
});

await onLocalStack("waiting_seq migration on the local Supabase stack", (keys) => {
  const game = stackGame(keys);
  const alertFor = (matchId: string, seq: number, queuedAt = T) => ({
    match_id: matchId,
    player: game.users[0]!.id,
    seq,
    queued_at: queuedAt,
  });
  const readQueue = async (matchId: string) =>
    (await game.service.from("notify_queue").select("seq, queued_at, waiting_seq").eq("match_id", matchId)).data;

  it("refuses a row without waiting_seq", async () => {
    const matchId = (await game.stored()).record.matchId;
    const { error } = await game.service.from("notify_queue").insert(alertFor(matchId, 2));
    expect(error?.code).toBe(NOT_NULL_VIOLATION);
    expect(await readQueue(matchId)).toEqual([]);
  }, 60_000);

  it("queue_turn_alerts stores a new alert waiting at its own seq, whatever waiting_seq it is given", async () => {
    const matchId = (await game.stored()).record.matchId;
    const p_alerts = [{ ...alertFor(matchId, 2), waiting_seq: 9 }];
    expect((await game.service.rpc("queue_turn_alerts", { p_alerts })).error).toBeNull();
    expect(await readQueue(matchId)).toEqual([{ seq: 2, queued_at: T, waiting_seq: 2 }]);
  }, 60_000);

  it("queue_turn_alerts replaces a raised alert with a newer one waiting at its own seq", async () => {
    const matchId = (await game.stored()).record.matchId;
    const first = [alertFor(matchId, 2)];
    expect((await game.service.rpc("queue_turn_alerts", { p_alerts: first })).error).toBeNull();
    const raised = await game.service.from("notify_queue").update({ waiting_seq: 4 }).eq("match_id", matchId);
    expect(raised.error).toBeNull();
    const older = [alertFor(matchId, 1, T + 1)];
    expect((await game.service.rpc("queue_turn_alerts", { p_alerts: older })).error).toBeNull();
    expect(await readQueue(matchId)).toEqual([{ seq: 2, queued_at: T, waiting_seq: 4 }]);
    const newer = [alertFor(matchId, 6, T + 9)];
    expect((await game.service.rpc("queue_turn_alerts", { p_alerts: newer })).error).toBeNull();
    expect(await readQueue(matchId)).toEqual([{ seq: 6, queued_at: T + 9, waiting_seq: 6 }]);
  }, 60_000);

  it.each(["signed-out client", "signed-in player"] as const)(
    "a %s still may not run queue_turn_alerts, and a re-read with the service role shows nothing changed",
    async (who) => {
      const matchId = (await game.stored()).record.matchId;
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : game.users[0]!.db;
      const { data, error } = await caller.rpc("queue_turn_alerts", { p_alerts: [alertFor(matchId, 1)] });
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(await readQueue(matchId)).toEqual([]);
    },
    60_000,
  );
});
