import { describe, expect, it } from "vitest";
import { createInvite, joinInvite } from "./invite.ts";
import { MemoryNotifyStore, TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { NotifyStore } from "./notifyStore.ts";
import { submit } from "./submit.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import { ADDRESSES, alertWorld, APP_URL, moveUntilNotified } from "./test/alerts.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";
import { bodyFor, MATCH, nextSide, NOW, SEED } from "./test/match.ts";

const D = TURN_ALERT_DELAY_MS;
const failingQueue: NotifyStore = {
  queue: () => Promise.reject(new Error("db down")),
  seen: async () => undefined,
  keep: async () => undefined,
  due: async () => [],
  markSent: async () => undefined,
  waitingSeq: async () => null,
};

describe("submit queues turn alerts after a saved move only", () => {
  it("a saved move queues one alert per notify effect, with the new seq and the move's time", async () => {
    const world = await alertWorld();
    const notify = new MemoryNotifyStore();
    const { seq, notified } = await moveUntilNotified({ ...world.submitDeps, notify }, world.store, NOW + 5);
    expect(await notify.due(NOW + 5 + D)).toEqual(
      notified.map((p) => ({ matchId: MATCH, player: p, seq, queuedAt: NOW + 5, waitingSeq: seq })),
    );
  });

  it("a refused submit queues nothing", async () => {
    const world = await alertWorld();
    const notify = new MemoryNotifyStore();
    const deps = { ...world.submitDeps, notify };
    const refused = await submit(deps, { matchId: MATCH, player: "alice", body: {}, now: NOW });
    expect(refused.ok).toBe(false);
    const stranger = await submit(deps, { matchId: MATCH, player: "mallory", body: { resign: true }, now: NOW });
    expect(stranger.ok).toBe(false);
    expect(await notify.due(NOW + 10 * D)).toEqual([]);
  });

  it("a conflicting submit queues nothing", async () => {
    const world = await alertWorld();
    const side = nextSide(world.start.secret);
    const player = world.start.record.players[side];
    const body = bodyFor(0, world.start.secret, side);
    expect(await submit(world.submitDeps, { matchId: MATCH, player, body, now: NOW })).toMatchObject({ ok: true });
    const notify = new MemoryNotifyStore();
    const again = await submit({ ...world.submitDeps, notify }, { matchId: MATCH, player, body, now: NOW + 1 });
    expect(again.ok).toBe(false);
    expect(await notify.due(NOW + 10 * D)).toEqual([]);
  });

  it("a failing queue does not change the outcome: the move is saved and reported", async () => {
    const world = await alertWorld();
    const side = nextSide(world.start.secret);
    const player = world.start.record.players[side];
    const body = bodyFor(0, world.start.secret, side);
    const deps = { ...world.submitDeps, notify: failingQueue };
    expect(await submit(deps, { matchId: MATCH, player, body, now: NOW })).toMatchObject({
      ok: true,
      value: { seq: 1 },
    });
    expect(world.store.stored(MATCH)?.record.seq).toBe(1);
  });
});

describe("joinInvite queues turn alerts for the new match", () => {
  it("a joined invite queues the first player's alert", async () => {
    const world = inviteWorld();
    const notify = new MemoryNotifyStore();
    const deps = { ...world.deps, notify };
    const made = await createInvite(deps, { host: HOST, sides: { mode: "host", hostSide: "lio" }, now: INVITE_NOW });
    if (!made.ok) throw new Error(`createInvite refused: ${made.error.code}`);
    const joined = await joinInvite(deps, { code: made.value.code, player: JOINER, now: INVITE_NOW + 1 });
    if (!joined.ok) throw new Error(`joinInvite refused: ${joined.error.code}`);
    const notified = joined.value.effects.flatMap((e) => ("notify" in e ? [e.notify] : []));
    expect(notified.length).toBeGreaterThan(0);
    expect(await notify.due(INVITE_NOW + 1 + D)).toEqual(
      notified.map((player) => ({
        matchId: joined.value.matchId,
        player,
        seq: 0,
        queuedAt: INVITE_NOW + 1,
        waitingSeq: 0,
      })),
    );
  });

  it("a refused join queues nothing, and a failing queue does not change a join's outcome", async () => {
    const world = inviteWorld();
    const notify = new MemoryNotifyStore();
    const refused = await joinInvite({ ...world.deps, notify }, { code: "NOPE0000", player: JOINER, now: INVITE_NOW });
    expect(refused.ok).toBe(false);
    expect(await notify.due(INVITE_NOW + 10 * D)).toEqual([]);
    const made = await createInvite(world.deps, { host: HOST, sides: { mode: "random" }, now: INVITE_NOW });
    if (!made.ok) throw new Error(`createInvite refused: ${made.error.code}`);
    const deps = { ...world.deps, notify: failingQueue };
    const joined = await joinInvite(deps, { code: made.value.code, player: JOINER, now: INVITE_NOW + 1 });
    expect(joined).toMatchObject({ ok: true, value: { matchId: "match-1" } });
  });
});

describe("turn alert emails carry nothing from the match", () => {
  it("the email is exactly the turn alert text, and no email or result holds the seed or a hand", async () => {
    const world = await alertWorld();
    const swept = await sweepTurnAlerts(world.deps, NOW + D);
    const everything = JSON.stringify({ swept, sent: world.mailer.sent });
    expect(everything).not.toContain(SEED);
    for (const card of ["l1", "s1", "n1", "n2", "z1"]) expect(everything).not.toMatch(new RegExp(`\\b${card}\\b`));
    for (const result of swept) expect(Object.keys(result).sort()).toEqual(["matchId", "player", "status"]);
    for (const email of world.mailer.sent) {
      expect(email.text).toContain(APP_URL);
      expect(Object.values(ADDRESSES)).toContain(email.to);
    }
  });
});
