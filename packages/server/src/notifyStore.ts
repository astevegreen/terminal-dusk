// The turn alert queue (docs/architecture.md, Decision 5, `notify_queue` and "Scheduled jobs", Notifications:
// "Email only if the turn is still unseen after about 20 minutes"). After a move, the host's `notify`
// effects become queued alerts; the sweep (sweepTurnAlerts.ts) emails the ones still unseen and unsent.
// `MemoryNotifyStore` is the in-memory store for tests; supabaseNotifyStore.ts is the Supabase one.
import type { HostEffect, PlayerId } from "@terminal-dusk/host";
import { later } from "./later.ts";

/** How long a turn must stay unseen before its alert is emailed: 20 minutes. */
export const TURN_ALERT_DELAY_MS = 20 * 60 * 1000;

/**
 * One player's turn alert for one match, made when the match reached `seq` at time `queuedAt`. `waitingSeq` is
 * the latest seq at which the player was known to be still waiting on that turn: `seq` when queued, raised by
 * `keep` when a move by someone else leaves them still waiting.
 */
export type TurnAlert = { matchId: string; player: PlayerId; seq: number; queuedAt: number; waitingSeq: number };

/** Where turn alerts wait. At most one alert is kept per (match, player). */
export interface NotifyStore {
  /**
   * Stores each alert. A newer seq for the same (match, player) replaces the stored one as a fresh alert
   * (not seen, not sent, with the new `queuedAt`); an older or equal seq changes nothing. A stored alert waits
   * at its own seq: its `waitingSeq` is its `seq`, whatever `waitingSeq` it came with.
   */
  queue(alerts: TurnAlert[]): Promise<void>;
  /** Marks the player's alert for the match seen, when its seq is at most `seq`. */
  seen(matchId: string, player: PlayerId, seq: number): Promise<void>;
  /**
   * The player is still waiting on their alerted turn now that the match is at `seq`: when their alert's
   * `waitingSeq` is below `seq`, raises it to `seq`. Its seq, queuedAt and seen flag do not change, so it is still
   * emailed 20 minutes after the turn began, unless seen. A sent alert is raised too: it may be a sweep's claim
   * whose email then fails, and the claim given back must keep the raise, or the next sweep finds it stale.
   */
  keep(matchId: string, player: PlayerId, seq: number): Promise<void>;
  /**
   * The alerts not seen, not sent and queued at least `TURN_ALERT_DELAY_MS` before `now`, ordered by
   * `queuedAt`, then match id, then player.
   */
  due(now: number): Promise<TurnAlert[]>;
  /**
   * Claims the alert: records it as sent at `now`, only when the stored alert still has the same seq and is not
   * sent yet. True when this call marked it; false when it was already sent (another sweep claimed it) or
   * replaced. Two calls at once never both get true, so the sweep claims before it emails.
   */
  markSent(alert: TurnAlert, now: number): Promise<boolean>;
  /**
   * Gives back a claim `markSent` made at `sentAt`, after its email failed: marks the alert not sent, only when
   * the stored alert still has the same seq and was marked sent at `sentAt`. Then it is due again.
   */
  release(alert: TurnAlert, sentAt: number): Promise<void>;
  /**
   * The stored `waitingSeq` of the alert's (match, player), as it is now: `null` when nothing is stored or the
   * stored alert has another seq. The sweep re-reads it before marking an alert stale. A sent alert answers too:
   * it may be another sweep's claim whose email then fails, and marking it stale once given back would lose it.
   */
  waitingSeq(alert: TurnAlert): Promise<number | null>;
}

/** One `TurnAlert` per `{ notify }` effect, for the match at `seq`, queued at `now`. Other effects are ignored. */
export function alertsFrom(matchId: string, seq: number, effects: readonly HostEffect[], now: number): TurnAlert[] {
  return effects.flatMap((effect) =>
    "notify" in effect ? [{ matchId, player: effect.notify, seq, queuedAt: now, waitingSeq: seq }] : [],
  );
}

type Stored = { alert: TurnAlert; seen: boolean; sentAt: number | null };

const keyOf = (matchId: string, player: PlayerId): string => JSON.stringify([matchId, player]);
const compareText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

/** A `NotifyStore` held in memory. It keeps copies, so callers cannot change what is stored by accident. */
export class MemoryNotifyStore implements NotifyStore {
  readonly #alerts = new Map<string, Stored>();

  queue(alerts: TurnAlert[]): Promise<void> {
    return later(() => {
      for (const alert of alerts) {
        const key = keyOf(alert.matchId, alert.player);
        const found = this.#alerts.get(key);
        if (found && found.alert.seq >= alert.seq) continue;
        this.#alerts.set(key, { alert: { ...alert, waitingSeq: alert.seq }, seen: false, sentAt: null });
      }
    });
  }

  seen(matchId: string, player: PlayerId, seq: number): Promise<void> {
    return later(() => {
      const found = this.#alerts.get(keyOf(matchId, player));
      if (found && found.alert.seq <= seq) found.seen = true;
    });
  }

  keep(matchId: string, player: PlayerId, seq: number): Promise<void> {
    return later(() => {
      const found = this.#alerts.get(keyOf(matchId, player));
      if (found && found.alert.waitingSeq < seq) found.alert.waitingSeq = seq;
    });
  }

  due(now: number): Promise<TurnAlert[]> {
    return later(() =>
      [...this.#alerts.values()]
        .filter((s) => !s.seen && s.sentAt === null && s.alert.queuedAt + TURN_ALERT_DELAY_MS <= now)
        .map((s) => ({ ...s.alert }))
        .sort(
          (a, b) => a.queuedAt - b.queuedAt || compareText(a.matchId, b.matchId) || compareText(a.player, b.player),
        ),
    );
  }

  markSent(alert: TurnAlert, now: number): Promise<boolean> {
    return later(() => {
      const found = this.#alerts.get(keyOf(alert.matchId, alert.player));
      if (!found || found.alert.seq !== alert.seq || found.sentAt !== null) return false;
      found.sentAt = now;
      return true;
    });
  }

  release(alert: TurnAlert, sentAt: number): Promise<void> {
    return later(() => {
      const found = this.#alerts.get(keyOf(alert.matchId, alert.player));
      if (found && found.alert.seq === alert.seq && found.sentAt === sentAt) found.sentAt = null;
    });
  }

  waitingSeq(alert: TurnAlert): Promise<number | null> {
    return later(() => {
      const found = this.#alerts.get(keyOf(alert.matchId, alert.player));
      return found && found.alert.seq === alert.seq ? found.alert.waitingSeq : null;
    });
  }

  /** A copy of what is stored for (match, player), or `null`. For tests. */
  stored(matchId: string, player: PlayerId): Stored | null {
    const found = this.#alerts.get(keyOf(matchId, player));
    return found ? { alert: { ...found.alert }, seen: found.seen, sentAt: found.sentAt } : null;
  }
}
