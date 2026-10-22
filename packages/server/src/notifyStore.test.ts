import { describe, expect, it } from "vitest";
import { alertsFrom, MemoryNotifyStore, TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { TurnAlert } from "./notifyStore.ts";

const T = 1_700_000_000_000;
const D = TURN_ALERT_DELAY_MS;
const alert = (matchId: string, player: string, seq: number, queuedAt = T): TurnAlert => ({
  matchId,
  player,
  seq,
  queuedAt,
});

describe("TURN_ALERT_DELAY_MS", () => {
  it("is 20 minutes", () => {
    expect(TURN_ALERT_DELAY_MS).toBe(20 * 60 * 1000);
  });
});

describe("alertsFrom", () => {
  it("turns each notify effect into a turn alert and ignores the other effects", () => {
    const effects = [{ notify: "alice" }, { deadlineAt: 5 }, { finalize: true as const }, { notify: "bob" }];
    expect(alertsFrom("m1", 3, effects, T)).toEqual([alert("m1", "alice", 3), alert("m1", "bob", 3)]);
  });

  it("gives no alerts when there is no notify effect", () => {
    expect(alertsFrom("m1", 3, [{ finalize: true }], T)).toEqual([]);
  });
});

describe("MemoryNotifyStore.queue", () => {
  it("keeps at most one alert per match and player", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 1), alert("m1", "alice", 1), alert("m1", "bob", 1)]);
    expect(await store.due(T + D)).toEqual([alert("m1", "alice", 1), alert("m1", "bob", 1)]);
  });

  it("a newer seq replaces an older one as a fresh alert: not seen, not sent, with the new queuedAt", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 1)]);
    await store.seen("m1", "alice", 1);
    await store.queue([alert("m1", "alice", 2, T + 5)]);
    expect(store.stored("m1", "alice")).toEqual({ alert: alert("m1", "alice", 2, T + 5), seen: false, sentAt: null });
    await store.markSent(alert("m1", "alice", 2, T + 5), T + D + 5);
    await store.queue([alert("m1", "alice", 3, T + 9)]);
    expect(store.stored("m1", "alice")).toEqual({ alert: alert("m1", "alice", 3, T + 9), seen: false, sentAt: null });
  });

  it("an older or equal seq changes nothing", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 2)]);
    await store.markSent(alert("m1", "alice", 2), T + D);
    await store.queue([alert("m1", "alice", 2, T + 7), alert("m1", "alice", 1, T + 8)]);
    expect(store.stored("m1", "alice")).toEqual({ alert: alert("m1", "alice", 2), seen: false, sentAt: T + D });
  });

  it("keeps a copy, so changing the queued object afterwards changes nothing", async () => {
    const store = new MemoryNotifyStore();
    const queued = alert("m1", "alice", 1);
    await store.queue([queued]);
    queued.seq = 9;
    expect(await store.due(T + D)).toEqual([alert("m1", "alice", 1)]);
  });
});

describe("MemoryNotifyStore.seen", () => {
  it("marks the alert seen when its seq is at most the seen seq", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 2), alert("m1", "bob", 2)]);
    await store.seen("m1", "alice", 2);
    await store.seen("m1", "bob", 5);
    expect(await store.due(T + D)).toEqual([]);
  });

  it("does not mark an alert newer than the seen seq, or another player's alert", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 2), alert("m1", "bob", 2)]);
    await store.seen("m1", "alice", 1);
    await store.seen("m2", "bob", 9);
    expect(await store.due(T + D)).toEqual([alert("m1", "alice", 2), alert("m1", "bob", 2)]);
  });
});

describe("MemoryNotifyStore.due", () => {
  it("gives only alerts queued at least 20 minutes before now", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 1, T), alert("m2", "alice", 1, T + 1)]);
    expect(await store.due(T + D - 1)).toEqual([]);
    expect(await store.due(T + D)).toEqual([alert("m1", "alice", 1, T)]);
  });

  it("orders by queuedAt, then match id, then player", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m2", "bob", 1, T), alert("m1", "bob", 1, T + 1), alert("m2", "alice", 1, T)]);
    await store.queue([alert("m1", "carol", 1, T)]);
    expect(await store.due(T + D + 1)).toEqual([
      alert("m1", "carol", 1, T),
      alert("m2", "alice", 1, T),
      alert("m2", "bob", 1, T),
      alert("m1", "bob", 1, T + 1),
    ]);
  });
});

describe("MemoryNotifyStore.markSent", () => {
  it("records the alert as sent at now, so it is never due again", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 1)]);
    await store.markSent(alert("m1", "alice", 1), T + D);
    expect(store.stored("m1", "alice")?.sentAt).toBe(T + D);
    expect(await store.due(T + 10 * D)).toEqual([]);
  });

  it("changes nothing when the stored alert has another seq", async () => {
    const store = new MemoryNotifyStore();
    await store.queue([alert("m1", "alice", 1)]);
    await store.queue([alert("m1", "alice", 2)]);
    await store.markSent(alert("m1", "alice", 1), T + D);
    expect(await store.due(T + D)).toEqual([alert("m1", "alice", 2)]);
  });
});
