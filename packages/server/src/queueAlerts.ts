// Queues the turn alerts of a move that is already saved. Shared by `submit` and `joinInvite`.
import type { HostEffect } from "@terminal-dusk/host";
import { alertsFrom } from "./notifyStore.ts";
import type { NotifyStore } from "./notifyStore.ts";

/**
 * Queues the alerts from `effects` for the match at `seq`, when there is a notify store. The move is
 * already saved, so a failing queue is swallowed: it never changes the caller's outcome, and never throws.
 */
export async function queueAlerts(
  notify: NotifyStore | undefined,
  matchId: string,
  seq: number,
  effects: readonly HostEffect[],
  now: number,
): Promise<void> {
  if (notify === undefined) return;
  const alerts = alertsFrom(matchId, seq, effects, now);
  if (alerts.length === 0) return;
  try {
    await notify.queue(alerts);
  } catch {
    // Nothing to undo: the move stands, and this turn simply gets no email.
  }
}
