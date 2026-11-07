// O11c (#309): the sweep re-reads an alert's waitingSeq just before marking it stale, so a `keep` that lands
// after the sweep read the alert, but before it marks it, keeps the still-waiting player's email.
import type { PlayerId } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { turnAlertEmail } from "./mailMessages.ts";
import type { Mailer } from "./mailer.ts";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import { submit } from "./submit.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import { ADDRESSES, alertWorld, APP_URL, withNotify } from "./test/alerts.ts";
import type { AlertWorld } from "./test/alerts.ts";
import { bodyFor, MATCH, nextSide, NOW } from "./test/match.ts";

const D = TURN_ALERT_DELAY_MS;
const sentTo = (players: string[]) => players.map((p) => turnAlertEmail(ADDRESSES[p]!, APP_URL));
const results = (players: string[], status: string) => players.map((player) => ({ matchId: MATCH, player, status }));

/** One player answers the first decision (no notify store, so nobody is kept): the match moves to seq 1. */
async function moveWithoutKeep(world: AlertWorld): Promise<{ mover: PlayerId; others: PlayerId[] }> {
  const side = nextSide(world.start.secret);
  const mover = world.start.record.players[side];
  const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset, notify: undefined };
  const body = bodyFor(0, world.start.secret, side);
  const moved = await submit(plainDeps, { matchId: MATCH, player: mover, body, now: NOW + 1 });
  if (!moved.ok) throw new Error(`submit refused: ${moved.error.code}`);
  return { mover, others: world.waiting.filter((p) => p !== mover) };
}

describe("sweepTurnAlerts re-checks an alert before marking it stale", () => {
  it("an alert kept after the sweep read it, but before it was marked, is emailed, not marked stale", async () => {
    const world = await alertWorld();
    let others: PlayerId[] = [];
    let mover = "";
    const notify = withNotify(world.notify, {
      due: async (now) => {
        const due = await world.notify.due(now);
        ({ mover, others } = await moveWithoutKeep(world));
        for (const player of others) await world.notify.keep(MATCH, player, 1);
        return due;
      },
    });
    expect(others).toEqual([]);
    const swept = await sweepTurnAlerts({ ...world.deps, notify }, NOW + D);
    expect(others.length).toBeGreaterThan(0);
    expect(swept).toEqual([...results([mover], "stale"), ...results(others, "sent")]);
    expect(world.mailer.sent).toEqual(sentTo(others));
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
  });

  it("an alert not kept by the time of the re-check is still marked stale, with no email", async () => {
    const world = await alertWorld();
    await moveWithoutKeep(world);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual(results(world.waiting, "stale"));
    expect(world.mailer.sent).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D)).toEqual([]);
  });

  it("a failing re-check leaves the alert due, and the next sweep sends it once kept", async () => {
    const world = await alertWorld();
    const { mover, others } = await moveWithoutKeep(world);
    const notify = withNotify(world.notify, { waitingSeq: () => Promise.reject(new Error("db down")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "failed"));
    expect(await world.notify.due(NOW + D)).toHaveLength(world.waiting.length);
    for (const player of others) await world.notify.keep(MATCH, player, 1);
    expect(await sweepTurnAlerts(world.deps, NOW + D)).toEqual([
      ...results([mover], "stale"),
      ...results(others, "sent"),
    ]);
    expect(world.mailer.sent).toEqual(sentTo(others));
  });

  it("a keep that lands while the email is in flight, which then fails, is not lost when the claim is given back", async () => {
    const world = await alertWorld();
    const mover = world.start.record.players[nextSide(world.start.secret)];
    let others: PlayerId[] = [];
    // Every email of the first sweep fails. While the first one to a player still waiting is in flight, its
    // alert is claimed, and the other player's move saves seq 1 and keeps everyone still waiting.
    const failing: Mailer = {
      send: async (email) => {
        if (others.length === 0 && email.to !== ADDRESSES[mover]) {
          ({ others } = await moveWithoutKeep(world));
          for (const player of others) await world.notify.keep(MATCH, player, 1);
        }
        return { ok: false, code: "unavailable" };
      },
    };
    await sweepTurnAlerts({ ...world.deps, mailer: failing }, NOW + D);
    expect(others.length).toBeGreaterThan(0);
    expect(await sweepTurnAlerts(world.deps, NOW + D + 1)).toEqual([
      ...results([mover], "stale"),
      ...results(others, "sent"),
    ]);
    expect(world.mailer.sent).toEqual(sentTo(others));
  });

  it("a second sweep that re-reads an alert while the first holds it, and gets it back, does not mark it stale", async () => {
    const world = await alertWorld();
    const mover = world.start.record.players[nextSide(world.start.secret)];
    const target = (await world.notify.due(NOW + D)).find((a) => a.player !== mover)!;
    const only = () => ({ due: () => Promise.resolve([target]) });
    let reread!: () => void;
    let givenBack!: () => void;
    const reReadDone = new Promise<void>((resolve) => (reread = resolve));
    const claimGivenBack = new Promise<void>((resolve) => (givenBack = resolve));
    // The second sweep read the alert before the move; it re-reads it while the first sweep holds the claim,
    // then waits until the first sweep has given the claim back before it marks it.
    const second = {
      ...world.deps,
      notify: withNotify(world.notify, {
        ...only(),
        waitingSeq: async (alert) => {
          const value = await world.notify.waitingSeq(alert);
          reread();
          await claimGivenBack;
          return value;
        },
      }),
    };
    let secondSweep: ReturnType<typeof sweepTurnAlerts> | undefined;
    // The first sweep's email is in flight when the other player moves and keeps the target; it then fails.
    const failing: Mailer = {
      send: async () => {
        const { others } = await moveWithoutKeep(world);
        for (const player of others) await world.notify.keep(MATCH, player, 1);
        secondSweep = sweepTurnAlerts(second, NOW + D);
        await reReadDone;
        return { ok: false, code: "unavailable" };
      },
    };
    const notify = withNotify(world.notify, only());
    expect(await sweepTurnAlerts({ ...world.deps, notify, mailer: failing }, NOW + D)).toEqual(
      results([target.player], "failed"),
    );
    givenBack();
    expect(await secondSweep).toEqual(results([target.player], "sent"));
    expect(world.mailer.sent).toEqual(sentTo([target.player]));
  });

  it("an alert for a match that ended is marked stale without a re-check", async () => {
    const world = await alertWorld();
    const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset, notify: undefined };
    const resigned = await submit(plainDeps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW });
    expect(resigned).toMatchObject({ ok: true });
    const notify = withNotify(world.notify, { waitingSeq: () => Promise.reject(new Error("not expected")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "stale"));
    expect(world.mailer.sent).toEqual([]);
  });
});
