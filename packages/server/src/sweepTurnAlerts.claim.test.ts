// The sweep claims an alert before it emails, so two sweeps running at once (the scheduled job fired twice, or a
// slow run overlapping the next) send each turn alert once (.claude/rules/server.md: scheduled jobs are safe to
// run twice). supabaseNotifyStore.stack.test.ts and sweepTurnAlerts.claim.stack.test.ts prove the claim on the
// real table.
import { describe, expect, it } from "vitest";
import { turnAlertEmail } from "./mailMessages.ts";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import { ADDRESSES, alertWorld, APP_URL, withNotify } from "./test/alerts.ts";
import { MATCH, NOW } from "./test/match.ts";

const D = TURN_ALERT_DELAY_MS;
const sentTo = (players: string[]) => players.map((p) => turnAlertEmail(ADDRESSES[p]!, APP_URL));
const results = (players: string[], status: string) => players.map((player) => ({ matchId: MATCH, player, status }));

describe("sweepTurnAlerts: two sweeps at once", () => {
  it("send each alert once; the sweep that lost the claim reports it taken", async () => {
    const world = await alertWorld();
    const [first, second] = await Promise.all([
      sweepTurnAlerts(world.deps, NOW + D),
      sweepTurnAlerts(world.deps, NOW + D),
    ]);
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
    const statuses = (player: string) =>
      [...first!, ...second!].filter((r) => r.player === player).map((r) => r.status);
    for (const player of world.waiting) expect(statuses(player).toSorted()).toEqual(["sent", "taken"]);
  });

  it("five overlapping sweeps still send each alert once", async () => {
    const world = await alertWorld();
    await Promise.all(Array.from({ length: 5 }, () => sweepTurnAlerts(world.deps, NOW + D)));
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });
});

describe("sweepTurnAlerts: the claim", () => {
  it("is taken before the email goes out", async () => {
    const world = await alertWorld();
    const sentBeforeClaim: number[] = [];
    const notify = withNotify(world.notify, {
      markSent: (alert, now) => {
        sentBeforeClaim.push(world.mailer.sent.length);
        return world.notify.markSent(alert, now);
      },
    });
    await sweepTurnAlerts({ ...world.deps, notify }, NOW + D);
    expect(sentBeforeClaim).toEqual(world.waiting.map((_, i) => i));
  });

  it("is given back when the email fails, so the next sweep sends it", async () => {
    const world = await alertWorld();
    world.waiting.forEach(() => world.mailer.failNext("unavailable"));
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "failed"));
    for (const player of world.waiting) expect(world.notify.stored(MATCH, player)?.sentAt).toBeNull();
    expect(await sweepTurnAlerts(world.deps, NOW + D + 1)).toEqual(results(world.waiting, "sent"));
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });

  it("an alert claimed by another sweep is taken, with no email", async () => {
    const world = await alertWorld();
    const due = await world.notify.due(NOW + D);
    for (const alert of due) await world.notify.markSent(alert, NOW + D);
    const notify = withNotify(world.notify, { due: () => Promise.resolve(due) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "taken"));
    expect(world.mailer.sent).toEqual([]);
  });

  it("a claim that cannot be given back after a failed email stays claimed: no email rather than two", async () => {
    const world = await alertWorld();
    world.waiting.forEach(() => world.mailer.failNext("unavailable"));
    const notify = withNotify(world.notify, { release: () => Promise.reject(new Error("db down")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "failed"));
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
    expect(world.mailer.sent).toEqual([]);
  });
});
