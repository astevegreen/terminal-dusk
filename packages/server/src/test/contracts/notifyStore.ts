// The NotifyStore contract: what both MemoryNotifyStore and SupabaseNotifyStore must do, checked only through
// the port, so one suite runs against the fake (stores.contract.test.ts) and the real table
// (stores.contract.stack.test.ts). `due` may see other tests' alerts, so each check keeps only its own matches'.
import type { PlayerId } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import { TURN_ALERT_DELAY_MS } from "../../notifyStore.ts";
import type { NotifyStore, TurnAlert } from "../../notifyStore.ts";

/** What one contract test works with; `setup` gives a fresh one at the start of each test. */
export type NotifyStoreHarness = {
  store: NotifyStore;
  /** Two players, as alerts name them. */
  players: [PlayerId, PlayerId];
  /** `count` fresh match ids an alert may name. */
  matches(count: number): Promise<string[]>;
};

// Far from the other stack tests' times.
const T = 6_000_000_000_000;
const D = TURN_ALERT_DELAY_MS;
const alert = (matchId: string, player: string, seq: number, queuedAt = T, waitingSeq = seq): TurnAlert => ({
  matchId,
  player,
  seq,
  queuedAt,
  waitingSeq,
});
const byText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

/** Registers the NotifyStore contract tests; call it inside a `describe`. */
export function notifyStoreContract(setup: () => NotifyStoreHarness, timeout?: number): void {
  /** A fresh harness, one match and its two players. */
  async function one() {
    const h = setup();
    const [m] = (await h.matches(1)) as [string];
    const [a, b] = h.players;
    const dueOf = async (now: number, ids = [m]) => (await h.store.due(now)).filter((x) => ids.includes(x.matchId));
    return { h, s: h.store, m, a, b, dueOf };
  }

  it(
    "queue keeps at most one alert per match and player",
    async () => {
      const { s, m, a, b, dueOf } = await one();
      await s.queue([alert(m, a, 1), alert(m, a, 1), alert(m, b, 1)]);
      const due = (await dueOf(T + D)).toSorted((x, y) => byText(x.player, y.player));
      expect(due).toEqual([alert(m, a, 1), alert(m, b, 1)].toSorted((x, y) => byText(x.player, y.player)));
    },
    timeout,
  );

  it(
    "a newer seq replaces an older one as a fresh alert, waiting at its own seq",
    async () => {
      const { s, m, a, dueOf } = await one();
      await s.queue([alert(m, a, 1)]);
      await s.seen(m, a, 1);
      await s.queue([alert(m, a, 2, T + 5, 9)]);
      expect(await dueOf(T + 5 + D)).toEqual([alert(m, a, 2, T + 5)]);
    },
    timeout,
  );

  it(
    "an older or equal seq changes nothing, so a sent alert stays sent",
    async () => {
      const { s, m, a, dueOf } = await one();
      await s.queue([alert(m, a, 2)]);
      expect(await s.markSent(alert(m, a, 2), T + D)).toBe(true);
      await s.queue([alert(m, a, 2, T + 7), alert(m, a, 1, T + 8)]);
      expect(await dueOf(T + 10 * D)).toEqual([]);
      expect(await s.markSent(alert(m, a, 2), T + 2 * D)).toBe(false);
      expect(await s.waitingSeq(alert(m, a, 2))).toBe(2);
    },
    timeout,
  );

  it(
    "seen marks an alert whose seq is at most the seen seq, and no newer one or another player's",
    async () => {
      const { s, m, a, b, dueOf } = await one();
      await s.queue([alert(m, a, 2), alert(m, b, 2)]);
      await s.seen(m, a, 1);
      await s.seen(m, b, 5);
      expect(await dueOf(T + D)).toEqual([alert(m, a, 2)]);
      await s.seen(m, a, 2);
      expect(await dueOf(T + D)).toEqual([]);
    },
    timeout,
  );

  it(
    "keep raises waitingSeq, never lowers it, raises a sent alert too, and due gives the raise",
    async () => {
      const { s, m, a, b, dueOf } = await one();
      await s.queue([alert(m, a, 2), alert(m, b, 2)]);
      await s.keep(m, a, 5);
      await s.keep(m, a, 4);
      await s.markSent(alert(m, b, 2), T + D);
      await s.keep(m, b, 3);
      expect(await dueOf(T + D)).toEqual([alert(m, a, 2, T, 5)]);
      expect(await s.waitingSeq(alert(m, a, 2))).toBe(5);
      expect(await s.waitingSeq(alert(m, b, 2))).toBe(3);
    },
    timeout,
  );

  it(
    "keep stores nothing when there is no alert, and a newer alert from queue replaces a kept one",
    async () => {
      const { s, m, a, b, dueOf } = await one();
      await s.keep(m, b, 4);
      expect(await s.waitingSeq(alert(m, b, 4))).toBeNull();
      await s.queue([alert(m, a, 2)]);
      await s.keep(m, a, 4);
      await s.queue([alert(m, a, 6, T + 9, 8)]);
      expect(await dueOf(T + 9 + D)).toEqual([alert(m, a, 6, T + 9)]);
    },
    timeout,
  );

  it(
    "due gives only alerts queued at least the delay before now, by queuedAt, then match id, then player",
    async () => {
      const h = setup();
      const [first, second] = (await h.matches(2)).toSorted(byText) as [string, string];
      const [lower, higher] = h.players.toSorted(byText) as [string, string];
      const ids = [first, second];
      await h.store.queue([alert(second, higher, 1, T + 200), alert(first, higher, 1, T + 201)]);
      await h.store.queue([alert(second, lower, 1, T + 200), alert(first, lower, 1, T + 200)]);
      const dueOf = async (now: number) => (await h.store.due(now)).filter((x) => ids.includes(x.matchId));
      expect(await dueOf(T + 200 + D - 1)).toEqual([]);
      expect(await dueOf(T + 201 + D)).toEqual([
        alert(first, lower, 1, T + 200),
        alert(second, lower, 1, T + 200),
        alert(second, higher, 1, T + 200),
        alert(first, higher, 1, T + 201),
      ]);
    },
    timeout,
  );

  it(
    "markSent is a claim: true once for the stored seq, then false, and false for another seq or none",
    async () => {
      const { s, m, a, b, dueOf } = await one();
      await s.queue([alert(m, a, 2)]);
      expect(await s.markSent(alert(m, a, 1), T + D)).toBe(false);
      expect(await s.markSent(alert(m, b, 2), T + D)).toBe(false);
      expect(await s.markSent(alert(m, a, 2), T + D)).toBe(true);
      expect(await s.markSent(alert(m, a, 2), T + D + 1)).toBe(false);
      expect(await dueOf(T + 10 * D)).toEqual([]);
    },
    timeout,
  );

  it(
    "release gives back only the claim made at sentAt for that seq, so the alert is due again",
    async () => {
      const { s, m, a, dueOf } = await one();
      await s.queue([alert(m, a, 2)]);
      await s.markSent(alert(m, a, 2), T + D);
      await s.release(alert(m, a, 2), T + D + 1);
      await s.release(alert(m, a, 1), T + D);
      expect(await dueOf(T + 2 * D)).toEqual([]);
      await s.release(alert(m, a, 2), T + D);
      expect(await dueOf(T + 2 * D)).toEqual([alert(m, a, 2)]);
    },
    timeout,
  );

  it(
    "waitingSeq gives null when nothing is stored or the stored alert has another seq",
    async () => {
      const { s, m, a, b } = await one();
      await s.queue([alert(m, a, 2)]);
      expect(await s.waitingSeq(alert(m, a, 1))).toBeNull();
      expect(await s.waitingSeq(alert(m, b, 2))).toBeNull();
      expect(await s.waitingSeq(alert(m, a, 2))).toBe(2);
    },
    timeout,
  );
}
