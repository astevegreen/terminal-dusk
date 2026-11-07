// The turn-alert claim on the local Supabase stack: SupabaseNotifyStore.markSent is a claim that only one of
// several calls at once wins, release gives a claim back, and two sweeps running at once over real tables send
// each alert once (sweepTurnAlerts.claim.test.ts proves the same with the memory stores).
// `due` sees every test's rows, so each sweep here keeps only the alerts of its own matches.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { MemoryMailer } from "./mailer.ts";
import { alertsFrom, TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { TurnAlert } from "./notifyStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import type { TurnAlertDeps } from "./sweepTurnAlerts.ts";
import { withNotify } from "./test/alerts.ts";
import { onLocalStack } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";

// Far from the other stack tests' times.
const T = 6_000_000_000_000;
const D = TURN_ALERT_DELAY_MS;

await onLocalStack("the turn-alert claim on the local Supabase stack", (keys) => {
  const game = stackGame(keys);
  const store = () => new SupabaseNotifyStore(game.service);
  /** A match put in at seq 0, with its first turn alerts queued at T. */
  const queued = async (): Promise<TurnAlert[]> => {
    const start = await game.stored();
    const alerts = alertsFrom(start.record.matchId, 0, start.effects, T);
    if (alerts.length === 0) throw new Error("the test match waits for nobody");
    await store().queue(alerts);
    return alerts;
  };
  const sentAt = async (alert: TurnAlert) =>
    (
      await game.service
        .from("notify_queue")
        .select("sent_at")
        .eq("match_id", alert.matchId)
        .eq("player", alert.player)
        .single()
    ).data?.sent_at;

  it("of five markSent calls at once on one alert, exactly one claims it", async () => {
    const [alert] = await queued();
    const claims = await Promise.all([0, 1, 2, 3, 4].map((i) => store().markSent(alert!, T + D + i)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await sentAt(alert!)).toBe(T + D + claims.indexOf(true));
  }, 60_000);

  it("release gives back only the claim made at its time, so the alert is due again", async () => {
    const [alert] = await queued();
    expect(await store().markSent(alert!, T + D)).toBe(true);
    await store().release(alert!, T + D + 1);
    expect(await sentAt(alert!)).toBe(T + D);
    await store().release(alert!, T + D);
    expect(await sentAt(alert!)).toBeNull();
    expect(await store().markSent(alert!, T + D + 2)).toBe(true);
  }, 60_000);

  it("two sweeps that both read the same due alerts send each alert once", async () => {
    const alerts = await queued();
    const matchId = alerts[0]!.matchId;
    const mailer = new MemoryMailer();
    const due = (await store().due(T + D)).filter((a) => a.matchId === matchId);
    expect(due).toHaveLength(alerts.length);
    const notify = withNotify(store(), { due: () => Promise.resolve(due) });
    const deps: TurnAlertDeps = {
      notify,
      store: new SupabaseStore(game.service),
      mailer,
      emailOf: (player) => `${player}@example.test`,
      appUrl: "https://play.example.test",
    };
    const [first, second] = await Promise.all([sweepTurnAlerts(deps, T + D), sweepTurnAlerts(deps, T + D)]);
    const statuses = [...first, ...second].map((r) => r.status).toSorted();
    expect(statuses).toEqual([...alerts.map(() => "sent"), ...alerts.map(() => "taken")].toSorted());
    expect(mailer.sent.map((e) => e.to).toSorted()).toEqual(alerts.map((a) => `${a.player}@example.test`).toSorted());
  }, 60_000);
});
