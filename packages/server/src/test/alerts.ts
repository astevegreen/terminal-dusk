// Test helpers for turn alerts: the test match in a MemoryStore, its first alerts queued in a
// MemoryNotifyStore, a MemoryMailer, and addresses for alice and bob.
import type { HostResult, PlayerId } from "@terminal-dusk/host";
import { MemoryMailer } from "../mailer.ts";
import { alertsFrom, MemoryNotifyStore } from "../notifyStore.ts";
import type { NotifyStore } from "../notifyStore.ts";
import type { MemoryStore } from "../store.ts";
import { submit } from "../submit.ts";
import type { SubmitDeps } from "../submit.ts";
import type { TurnAlertDeps } from "../sweepTurnAlerts.ts";
import { bodyFor, MATCH, nextSide, NOW, setup } from "./match.ts";

export const APP_URL = "https://play.example.test";
export const ADDRESSES: Record<string, string> = { alice: "alice@example.test", bob: "bob@example.test" };

export type AlertWorld = {
  store: MemoryStore;
  notify: MemoryNotifyStore;
  mailer: MemoryMailer;
  deps: TurnAlertDeps;
  submitDeps: SubmitDeps;
  start: HostResult;
  /** The players the new match is waiting for, from hostCreate's notify effects. */
  waiting: PlayerId[];
};

/** A notify store that passes every call to `inner`, except the ones in `override`. */
export const withNotify = (inner: NotifyStore, override: Partial<NotifyStore>): NotifyStore => ({
  queue: (alerts) => inner.queue(alerts),
  seen: (matchId, player, seq) => inner.seen(matchId, player, seq),
  keep: (matchId, player, seq) => inner.keep(matchId, player, seq),
  due: (now) => inner.due(now),
  markSent: (alert, now) => inner.markSent(alert, now),
  waitingSeq: (alert) => inner.waitingSeq(alert),
  ...override,
});

/**
 * Answers "match-1"'s waiting decisions through submit at `now`, one at a time, until a saved move has a
 * notify effect. Returns that move's seq and the players it notified.
 */
export async function moveUntilNotified(
  deps: SubmitDeps,
  store: MemoryStore,
  now: number,
): Promise<{ seq: number; notified: PlayerId[] }> {
  for (let tries = 0; tries < 10; tries++) {
    const { record, secret } = (await store.load(MATCH))!;
    const side = nextSide(secret);
    const body = bodyFor(record.seq, secret, side);
    const moved = await submit(deps, { matchId: MATCH, player: record.players[side], body, now });
    if (!moved.ok) throw new Error(`submit refused: ${moved.error.code}`);
    const notified = moved.value.effects.flatMap((e) => ("notify" in e ? [e.notify] : []));
    if (notified.length > 0) return { seq: moved.value.seq, notified };
  }
  throw new Error("no move notified anybody");
}

/** "match-1" at seq 0, with its first turn alerts queued at NOW. */
export async function alertWorld(): Promise<AlertWorld> {
  const { store, deps: plain, start } = setup();
  const notify = new MemoryNotifyStore();
  const mailer = new MemoryMailer();
  const first = alertsFrom(MATCH, 0, start.effects, NOW);
  if (first.length === 0) throw new Error("the test match waits for nobody");
  await notify.queue(first);
  const deps: TurnAlertDeps = {
    notify,
    store,
    mailer,
    emailOf: (player) => ADDRESSES[player] ?? null,
    appUrl: APP_URL,
  };
  return { store, notify, mailer, deps, submitDeps: { ...plain, notify }, start, waiting: first.map((a) => a.player) };
}
