// SupabaseNotifyStore on the local Supabase stack: O8d's store behaviour (notifyStore.test.ts) against the real
// notify_queue table and queue_turn_alerts function. Alerts name real test matches, as the table requires;
// `due` sees every test's rows, so each check keeps only the alerts of its own matches.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { TurnAlert } from "./notifyStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { freshId } from "./migrations/localStack.ts";
import { onLocalStack } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";

// Far from the other stack tests' times.
const T = 5_000_000_000_000;
const D = TURN_ALERT_DELAY_MS;
const alert = (matchId: string, player: string, seq: number, queuedAt = T, waitingSeq = seq): TurnAlert => ({
  matchId,
  player,
  seq,
  queuedAt,
  waitingSeq,
});

await onLocalStack("SupabaseNotifyStore on the local Supabase stack", (keys) => {
  const game = stackGame(keys);
  const store = () => new SupabaseNotifyStore(game.service);
  const alice = () => game.users[0]!.id;
  const bob = () => game.users[1]!.id;
  /** `count` matches put in at seq 0, by their ids. */
  const matches = async (count: number): Promise<string[]> => {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) ids.push((await game.stored()).record.matchId);
    return ids;
  };
  /** The due alerts of the given matches only, in the order `due` gave them. */
  const dueOf = async (now: number, matchIds: string[]): Promise<TurnAlert[]> =>
    (await store().due(now)).filter((a) => matchIds.includes(a.matchId));
  /** The stored row for (match, player), read with the service role. */
  const row = async (matchId: string, player: string) =>
    (await game.service.from("notify_queue").select("*").eq("match_id", matchId).eq("player", player)).data?.[0];

  it("queue keeps at most one alert per match and player", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 1), alert(m1!, alice(), 1), alert(m1!, bob(), 1)]);
    const due = await dueOf(T + D, [m1!]);
    expect(due.toSorted((a, b) => a.player.localeCompare(b.player))).toEqual(
      [alert(m1!, alice(), 1), alert(m1!, bob(), 1)].toSorted((a, b) => a.player.localeCompare(b.player)),
    );
  }, 60_000);

  it("a newer seq replaces an older one as a fresh alert: not seen, not sent, with the new queued_at", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 1)]);
    await store().seen(m1!, alice(), 1);
    await store().queue([alert(m1!, alice(), 2, T + 5, 9)]);
    expect(await row(m1!, alice())).toEqual({
      match_id: m1,
      player: alice(),
      seq: 2,
      queued_at: T + 5,
      seen_seq: null,
      sent_at: null,
      waiting_seq: 2,
    });
  }, 60_000);

  it("a sent alert followed by a new turn is due again once the delay has passed", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2)]);
    await store().markSent(alert(m1!, alice(), 2), T + D);
    expect(await dueOf(T + 10 * D, [m1!])).toEqual([]);
    await store().queue([alert(m1!, alice(), 3, T + 2 * D)]);
    expect(await dueOf(T + 3 * D - 1, [m1!])).toEqual([]);
    expect(await dueOf(T + 3 * D, [m1!])).toEqual([alert(m1!, alice(), 3, T + 2 * D)]);
    expect((await row(m1!, alice()))?.sent_at).toBeNull();
  }, 60_000);

  it("an older or equal seq changes nothing", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2)]);
    await store().markSent(alert(m1!, alice(), 2), T + D);
    await store().queue([alert(m1!, alice(), 2, T + 7), alert(m1!, alice(), 1, T + 8)]);
    expect(await row(m1!, alice())).toEqual({
      match_id: m1,
      player: alice(),
      seq: 2,
      queued_at: T,
      seen_seq: null,
      sent_at: T + D,
      waiting_seq: 2,
    });
  }, 60_000);

  it("keep raises an unsent alert's waiting_seq, leaving its seq, queued_at and seen_seq, and due gives it", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2), alert(m1!, bob(), 2)]);
    await store().seen(m1!, bob(), 2);
    await store().keep(m1!, alice(), 4);
    await store().keep(m1!, bob(), 4);
    expect(await row(m1!, alice())).toMatchObject({ seq: 2, queued_at: T, seen_seq: null, waiting_seq: 4 });
    expect(await row(m1!, bob())).toMatchObject({ seq: 2, queued_at: T, seen_seq: 2, waiting_seq: 4 });
    expect(await dueOf(T + D, [m1!])).toEqual([alert(m1!, alice(), 2, T, 4)]);
  }, 60_000);

  it("a newer alert from queue replaces a kept one, waiting at its own seq", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2)]);
    await store().keep(m1!, alice(), 4);
    await store().queue([alert(m1!, alice(), 6, T + 9, 8)]);
    expect(await row(m1!, alice())).toMatchObject({ seq: 6, queued_at: T + 9, sent_at: null, waiting_seq: 6 });
  }, 60_000);

  it("keep changes nothing when waiting_seq is at or above seq, or the alert is sent", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2), alert(m1!, bob(), 2)]);
    await store().keep(m1!, alice(), 5);
    await store().keep(m1!, alice(), 4);
    await store().markSent(alert(m1!, bob(), 2), T + D);
    await store().keep(m1!, bob(), 3);
    expect((await row(m1!, alice()))?.waiting_seq).toBe(5);
    expect(await row(m1!, bob())).toMatchObject({ seq: 2, sent_at: T + D, waiting_seq: 2 });
  }, 60_000);

  it("seen marks the alert when its seq is at most the seen seq", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 2), alert(m1!, bob(), 2)]);
    await store().seen(m1!, alice(), 2);
    await store().seen(m1!, bob(), 5);
    expect(await dueOf(T + D, [m1!])).toEqual([]);
  }, 60_000);

  it("seen does not mark an alert newer than the seen seq, or another match's alert", async () => {
    const [m1, m2] = await matches(2);
    await store().queue([alert(m1!, alice(), 2), alert(m2!, bob(), 2)]);
    await store().seen(m1!, alice(), 1);
    await store().seen(m1!, bob(), 9);
    expect(await dueOf(T + D, [m1!, m2!])).toEqual(
      [alert(m1!, alice(), 2), alert(m2!, bob(), 2)].toSorted((a, b) =>
        a.matchId < b.matchId ? -1 : Number(a.matchId > b.matchId),
      ),
    );
  }, 60_000);

  it("due gives only alerts queued at least 20 minutes before now", async () => {
    const [m1, m2] = await matches(2);
    await store().queue([alert(m1!, alice(), 1, T + 100), alert(m2!, alice(), 1, T + 101)]);
    expect(await dueOf(T + 100 + D - 1, [m1!, m2!])).toEqual([]);
    expect(await dueOf(T + 100 + D, [m1!, m2!])).toEqual([alert(m1!, alice(), 1, T + 100)]);
  }, 60_000);

  it("due orders by queued_at, then match id, then player", async () => {
    const ids = (await matches(2)).toSorted();
    const [first, second] = ids as [string, string];
    const carol = freshId();
    const [lower, higher] = [alice(), bob()].toSorted() as [string, string];
    await store().queue([alert(second, higher, 1, T + 200), alert(first, higher, 1, T + 201)]);
    await store().queue([alert(second, lower, 1, T + 200), alert(first, carol, 1, T + 200)]);
    expect(await dueOf(T + 201 + D, ids)).toEqual([
      alert(first, carol, 1, T + 200),
      alert(second, lower, 1, T + 200),
      alert(second, higher, 1, T + 200),
      alert(first, higher, 1, T + 201),
    ]);
  }, 60_000);

  it("markSent records the alert as sent at now, so it is never due again", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 1)]);
    await store().markSent(alert(m1!, alice(), 1), T + D);
    expect((await row(m1!, alice()))?.sent_at).toBe(T + D);
    expect(await dueOf(T + 10 * D, [m1!])).toEqual([]);
  }, 60_000);

  it("markSent changes nothing when the stored alert has another seq", async () => {
    const [m1] = await matches(1);
    await store().queue([alert(m1!, alice(), 1)]);
    await store().queue([alert(m1!, alice(), 2)]);
    await store().markSent(alert(m1!, alice(), 1), T + D);
    expect(await dueOf(T + D, [m1!])).toEqual([alert(m1!, alice(), 2)]);
  }, 60_000);
});
