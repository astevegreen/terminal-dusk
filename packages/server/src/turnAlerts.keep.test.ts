// A turn alert stays live while its player is still waiting on the decision it is for (#267). In the test match's
// opening simultaneous pick both players are alerted at seq 0; when one answers, the other gets no new `notify`
// but still waits, so `submit` keeps their alert and the sweep still emails them 20 minutes after the turn began.
import type { Side } from "@terminal-dusk/engine";
import type { HostEffect, PlayerId } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { turnAlertEmail } from "./mailMessages.ts";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { NotifyStore } from "./notifyStore.ts";
import { keepWaiting } from "./queueAlerts.ts";
import type { MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import type { SubmitDeps } from "./submit.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import type { TurnAlertResult } from "./sweepTurnAlerts.ts";
import { ADDRESSES, alertWorld, APP_URL, withNotify } from "./test/alerts.ts";
import type { AlertWorld } from "./test/alerts.ts";
import { bodyFor, created, MATCH, nextSide, NOW } from "./test/match.ts";
import { recordingNotify } from "./test/seen.ts";

const D = TURN_ALERT_DELAY_MS;
const MINUTE = 60_000;
const sentTo = (players: string[]) => players.map((p) => turnAlertEmail(ADDRESSES[p]!, APP_URL));
const statusOf = (results: TurnAlertResult[]) => Object.fromEntries(results.map((r) => [r.player, r.status]));
const notified = (effects: readonly HostEffect[]) => effects.flatMap((e) => ("notify" in e ? [e.notify] : []));

type Seat = { side: Side; player: PlayerId };

/** The test match's opening simultaneous pick: both players alerted at seq 0 and minute 0. */
async function pickWorld(): Promise<{ world: AlertWorld; first: Seat; other: Seat }> {
  const world = await alertWorld();
  const { players } = world.start.record;
  if (world.waiting.length !== 2) throw new Error("the test match does not open with a simultaneous pick");
  const side = nextSide(world.start.secret);
  const otherSide: Side = side === "lio" ? "sae" : "lio";
  return { world, first: { side, player: players[side] }, other: { side: otherSide, player: players[otherSide] } };
}

/** Answers `side`'s waiting decision in "match-1" through submit at `now`. */
async function answer(world: AlertWorld, deps: SubmitDeps, side: Side, now: number) {
  const { record, secret } = (await world.store.load(MATCH))!;
  const body = bodyFor(record.seq, secret, side);
  const moved = await submit(deps, { matchId: MATCH, player: record.players[side], body, now });
  if (!moved.ok) throw new Error(`submit refused: ${moved.error.code}`);
  return moved.value;
}

describe("a simultaneous pick: the player still waiting keeps their turn alert", () => {
  it("the other player answers at minute 5; the still-waiting player gets exactly one email at minute 20, not at minute 25", async () => {
    const { world, first, other } = await pickWorld();
    const moved = await answer(world, world.submitDeps, first.side, NOW + 5 * MINUTE);
    expect(notified(moved.effects)).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + D - 1)).toEqual([]);
    expect(statusOf(await sweepTurnAlerts(world.deps, NOW + D))).toEqual({
      [first.player]: "stale",
      [other.player]: "sent",
    });
    expect(world.mailer.sent).toEqual(sentTo([other.player]));
    expect(await sweepTurnAlerts(world.deps, NOW + 25 * MINUTE)).toEqual([]);
    expect(world.mailer.sent).toEqual(sentTo([other.player]));
  });

  it("the still-waiting player answers at minute 10: no email", async () => {
    const { world, first, other } = await pickWorld();
    await answer(world, world.submitDeps, first.side, NOW + 5 * MINUTE);
    await answer(world, world.submitDeps, other.side, NOW + 10 * MINUTE);
    const swept = await sweepTurnAlerts(world.deps, NOW + D);
    expect(swept.map((r) => r.status)).not.toContain("sent");
    expect(world.mailer.sent).toEqual([]);
  });

  it("their seen call for the seq the turn began, arriving after the other player's move, still stops the email", async () => {
    const { world, first, other } = await pickWorld();
    await answer(world, world.submitDeps, first.side, NOW + 5 * MINUTE);
    await world.notify.seen(MATCH, other.player, 0);
    expect(statusOf(await sweepTurnAlerts(world.deps, NOW + D))).toEqual({ [first.player]: "stale" });
    expect(world.mailer.sent).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 3 * D)).toEqual([]);
  });

  it("after their email is sent, a later move that leaves them still waiting sends nothing more", async () => {
    const { world, first, other } = await pickWorld();
    expect(statusOf(await sweepTurnAlerts(world.deps, NOW + D))).toEqual({
      [first.player]: "sent",
      [other.player]: "sent",
    });
    const moved = await answer(world, world.submitDeps, first.side, NOW + D + MINUTE);
    expect(notified(moved.effects)).toEqual([]);
    expect(world.notify.stored(MATCH, other.player)).toMatchObject({
      alert: { seq: 0, waitingSeq: 0 },
      sentAt: NOW + D,
    });
    expect(await sweepTurnAlerts(world.deps, NOW + 2 * D + MINUTE)).toEqual([]);
    expect(await sweepTurnAlerts(world.deps, NOW + 10 * D)).toEqual([]);
    expect(world.mailer.sent).toEqual(sentTo([first.player, other.player]));
  });

  it("a player with no decision after the move is not kept, so their alert is still stale", async () => {
    const { world, first, other } = await pickWorld();
    const moved = await answer(world, world.submitDeps, first.side, NOW + 5 * MINUTE);
    const frames = world.store.stored(MATCH)!.frames;
    expect(frames[first.side].decision).toBeNull();
    expect(frames[other.side].decision).not.toBeNull();
    expect(world.notify.stored(MATCH, first.player)?.alert).toMatchObject({ seq: 0, waitingSeq: 0 });
    expect(world.notify.stored(MATCH, other.player)?.alert).toMatchObject({
      seq: 0,
      queuedAt: NOW,
      waitingSeq: moved.seq,
    });
    expect(statusOf(await sweepTurnAlerts(world.deps, NOW + D))[first.player]).toBe("stale");
  });
});

describe("submit keeps alerts after a saved move only", () => {
  it("a refused, stale, conflicting or unsaved submit keeps nothing", async () => {
    const { world, first, other } = await pickWorld();
    const calls: string[] = [];
    const notify = recordingNotify(world.notify, calls);
    const deps = { ...world.submitDeps, notify };
    const body = bodyFor(0, world.start.secret, first.side);
    const conflicting: MatchStore = { load: (id) => world.store.load(id), commit: async () => "conflict" };
    const failing: MatchStore = {
      load: (id) => world.store.load(id),
      commit: () => Promise.reject(new Error("db down")),
    };
    const refusals = [
      await submit(deps, { matchId: MATCH, player: first.player, body: {}, now: NOW }),
      await submit(deps, { matchId: MATCH, player: "mallory", body: { resign: true }, now: NOW }),
      await submit({ ...deps, store: conflicting }, { matchId: MATCH, player: first.player, body, now: NOW }),
      await submit({ ...deps, store: failing }, { matchId: MATCH, player: first.player, body, now: NOW }),
    ];
    const plain = { store: world.store, ruleset: world.submitDeps.ruleset };
    expect(await submit(plain, { matchId: MATCH, player: first.player, body, now: NOW })).toMatchObject({ ok: true });
    refusals.push(await submit(deps, { matchId: MATCH, player: first.player, body, now: NOW + 1 }));
    expect(refusals.map((r) => r.ok)).toEqual([false, false, false, false, false]);
    expect(calls.filter((c) => c.startsWith("keep"))).toEqual([]);
    expect(world.notify.stored(MATCH, other.player)?.alert.waitingSeq).toBe(0);
  });

  it("a saved move keeps the still-waiting player's alert at the new seq", async () => {
    const { world, other } = await pickWorld();
    const calls: string[] = [];
    const deps = { ...world.submitDeps, notify: recordingNotify(world.notify, calls) };
    const moved = await answer(world, deps, nextSide(world.start.secret), NOW + 5 * MINUTE);
    expect(calls.filter((c) => c.startsWith("keep"))).toEqual([`keep ${MATCH} ${other.player} ${moved.seq}`]);
  });

  it("a failing keep does not change the outcome: the move is saved and reported", async () => {
    const { world, first } = await pickWorld();
    const notify = withNotify(world.notify, { keep: () => Promise.reject(new Error("db down")) });
    const body = bodyFor(0, world.start.secret, first.side);
    const moved = await submit(
      { ...world.submitDeps, notify },
      { matchId: MATCH, player: first.player, body, now: NOW },
    );
    expect(moved).toMatchObject({ ok: true, value: { seq: 1 } });
    expect(world.store.stored(MATCH)?.record.seq).toBe(1);
  });
});

describe("keepWaiting reads who is waiting from the move's new frames", () => {
  // The new match: both players have a decision in their frames. Seq 3 stands for "after some move".
  const start = created();
  const write = { record: { ...start.record, seq: 3 }, frames: start.frames };
  const keepsOf = async (effects: HostEffect[], w = write, override: Partial<NotifyStore> = {}) => {
    const world = await alertWorld();
    const calls: string[] = [];
    await keepWaiting(withNotify(recordingNotify(world.notify, calls), override), MATCH, w, effects);
    return calls.filter((c) => c.startsWith("keep"));
  };

  it("keeps every player with a decision in their new frame and no notify effect, at the new seq", async () => {
    expect(await keepsOf([{ finalize: true }])).toEqual([`keep ${MATCH} alice 3`, `keep ${MATCH} bob 3`]);
  });

  it("does not keep a player the move notified: their new alert was queued instead", async () => {
    expect(await keepsOf([{ notify: "alice" }])).toEqual([`keep ${MATCH} bob 3`]);
  });

  it("does not keep a player whose new frame has no decision", async () => {
    const frames = { ...start.frames, sae: { ...start.frames.sae, decision: null } };
    expect(await keepsOf([], { ...write, frames })).toEqual([`keep ${MATCH} alice 3`]);
  });

  it("does nothing without a notify store, and one failing keep neither throws nor stops the other", async () => {
    await expect(keepWaiting(undefined, MATCH, write, [])).resolves.toBeUndefined();
    const world = await alertWorld();
    const calls: string[] = [];
    const notify = withNotify(recordingNotify(world.notify, calls), {
      keep: (matchId, player, seq) => {
        calls.push(`keep ${matchId} ${player} ${seq}`);
        return player === "alice" ? Promise.reject(new Error("db down")) : world.notify.keep(matchId, player, seq);
      },
    });
    await expect(keepWaiting(notify, MATCH, write, [])).resolves.toBeUndefined();
    expect(calls).toEqual([`keep ${MATCH} alice 3`, `keep ${MATCH} bob 3`]);
    expect(world.notify.stored(MATCH, "bob")?.alert.waitingSeq).toBe(3);
  });
});
