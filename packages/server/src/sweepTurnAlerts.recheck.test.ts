// O11c (#309): the sweep re-reads an alert's waitingSeq just before marking it stale, so a `keep` that lands
// after the sweep read the alert, but before it marks it, keeps the still-waiting player's email.
import type { PlayerId } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { turnAlertEmail } from "./mailMessages.ts";
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
  const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset };
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

  it("an alert for a match that ended is marked stale without a re-check", async () => {
    const world = await alertWorld();
    const plainDeps = { store: world.store, ruleset: world.submitDeps.ruleset };
    const resigned = await submit(plainDeps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW });
    expect(resigned).toMatchObject({ ok: true });
    const notify = withNotify(world.notify, { waitingSeq: () => Promise.reject(new Error("not expected")) });
    expect(await sweepTurnAlerts({ ...world.deps, notify }, NOW + D)).toEqual(results(world.waiting, "stale"));
    expect(world.mailer.sent).toEqual([]);
  });
});
