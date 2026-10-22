import { describe, expect, it } from "vitest";
import { turnAlertEmail } from "./mailMessages.ts";
import { alertsFrom, TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import { ADDRESSES, alertWorld, APP_URL, moveUntilNotified, withNotify } from "./test/alerts.ts";
import { bodyFor, created, MATCH, nextSide, NOW } from "./test/match.ts";

const D = TURN_ALERT_DELAY_MS;
const sentTo = (players: string[]) => players.map((p) => turnAlertEmail(ADDRESSES[p]!, APP_URL));
const results = (players: string[], status: string) => players.map((player) => ({ matchId: MATCH, player, status }));

describe("sweepTurnAlerts: when an email goes out", () => {
  it("nothing is sent before 20 minutes", async () => {
    const world = await alertWorld();
    expect(await sweepTurnAlerts(world.deps, NOW + D - 1)).toEqual([]);
    expect(world.mailer.sent).toEqual([]);
  });

  it("one email at 20 minutes, with the turn alert text and the app address", async () => {
    const world = await alertWorld();
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "sent"));
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });

  it("never a second email for the same alert", async () => {
    const world = await alertWorld();
    await sweepTurnAlerts(world.deps, NOW + D);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 10 * D)).toEqual([]);
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });

  it("a seen alert is not sent", async () => {
    const world = await alertWorld();
    for (const player of world.waiting) await world.notify.seen(MATCH, player, 0);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual([]);
    expect(world.mailer.sent).toEqual([]);
  });

  it("an alert kept up to the match's seq is sent, though its turn began at an earlier seq", async () => {
    const world = await alertWorld();
    const side = nextSide(world.start.secret);
    const mover = world.start.record.players[side];
    const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset };
    const body = bodyFor(0, world.start.secret, side);
    expect(await submit(plainDeps, { matchId: MATCH, player: mover, body, now: NOW + 1 })).toMatchObject({ ok: true });
    const others = world.waiting.filter((p) => p !== mover);
    for (const player of others) await world.notify.keep(MATCH, player, 1);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual([
      ...results([mover], "stale"),
      ...results(others, "sent"),
    ]);
    expect(world.mailer.sent).toEqual(sentTo(others));
  });

  it("a new turn after a sent alert queues a fresh one, which is emailed 20 minutes later", async () => {
    const world = await alertWorld();
    await sweepTurnAlerts(world.deps, NOW + D);
    const { notified } = await moveUntilNotified(world.submitDeps, world.store, NOW + D + 1);
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D + 1)).toEqual(results(notified, "sent"));
    expect(world.mailer.sent).toEqual([...sentTo(world.waiting), ...sentTo(notified)]);
  });
});

describe("sweepTurnAlerts: alerts marked sent without an email", () => {
  it("a move by the player before the sweep makes the alert stale", async () => {
    const world = await alertWorld();
    const side = nextSide(world.start.secret);
    const body = bodyFor(0, world.start.secret, side);
    const player = world.start.record.players[side];
    const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset };
    expect(await submit(plainDeps, { matchId: MATCH, player, body, now: NOW + 1 })).toMatchObject({ ok: true });
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "stale"));
    expect(world.mailer.sent).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
  });

  it("an alert for a match that ended is stale", async () => {
    const world = await alertWorld();
    const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset };
    const resigned = await submit(plainDeps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW });
    expect(resigned).toMatchObject({ ok: true });
    expect(world.store.stored(MATCH)?.record.status.kind).toBe("over");
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "stale"));
    expect(world.mailer.sent).toEqual([]);
  });

  it("an alert whose match is not found is stale and is never tried again", async () => {
    const world = await alertWorld();
    await world.notify.queue([{ matchId: "gone", player: "alice", seq: 0, queuedAt: NOW - 1, waitingSeq: 0 }]);
    const swept = await sweepTurnAlerts(world.deps, NOW + D);
    expect(swept[0]).toEqual({ matchId: "gone", player: "alice", status: "stale" });
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
  });

  it("a player with no address gets no email, and the alert is not tried again", async () => {
    const world = await alertWorld();
    const deps = { ...world.deps, emailOf: () => null };
    expect(await sweepTurnAlerts(deps, NOW + D)).toEqual(results(world.waiting, "noAddress"));
    expect(world.mailer.sent).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
  });
});

describe("sweepTurnAlerts: failures are retried on the next sweep", () => {
  it("a mailer failure leaves the alert due, and the next sweep sends it", async () => {
    const world = await alertWorld();
    world.waiting.forEach(() => world.mailer.failNext("unavailable"));
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "failed"));
    expect(world.mailer.sent).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + D + 60_000)).toEqual(results(world.waiting, "sent"));
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });

  it("a failing load leaves the alert due, and the next sweep sends it", async () => {
    const world = await alertWorld();
    let failures = world.waiting.length;
    const flaky: MatchStore = {
      load: (id) => (failures-- > 0 ? Promise.reject(new Error("db down")) : world.store.load(id)),
      commit: (id, seq, write) => world.store.commit(id, seq, write),
    };
    const deps = { ...world.deps, store: flaky };
    expect(await sweepTurnAlerts(deps, NOW + D)).toEqual(results(world.waiting, "failed"));
    expect(await sweepTurnAlerts(deps, NOW + D + 60_000)).toEqual(results(world.waiting, "sent"));
    expect(world.mailer.sent).toEqual(sentTo(world.waiting));
  });

  it("a throwing emailOf or markSent leaves the alert due", async () => {
    const world = await alertWorld();
    const throwing = () => {
      throw new Error("auth down");
    };
    expect(await sweepTurnAlerts({ ...world.deps, emailOf: throwing }, NOW + D)).toEqual(
      results(world.waiting, "failed"),
    );
    const notify = withNotify(world.notify, { markSent: () => Promise.reject(new Error("db down")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "failed"));
    expect(await world.notify.due(NOW + D)).toHaveLength(world.waiting.length);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "sent"));
  });

  it("one alert's failure does not stop the sweep", async () => {
    const world = await alertWorld();
    const second = created("match-2");
    world.store.insert("match-2", { record: second.record, secret: second.secret, frames: second.frames });
    await world.notify.queue(alertsFrom("match-2", 0, second.effects, NOW));
    world.mailer.failNext("rejected");
    const swept = await sweepTurnAlerts(world.deps, NOW + D);
    expect(swept.map((r) => r.status)).toEqual(["failed", ...swept.slice(1).map(() => "sent")]);
    expect(swept.length).toBe(2 * world.waiting.length);
    expect(world.mailer.sent).toHaveLength(swept.length - 1);
  });

  it("a failing due gives no results and does not throw", async () => {
    const world = await alertWorld();
    const notify = withNotify(world.notify, { due: () => Promise.reject(new Error("db down")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual([]);
  });
});
