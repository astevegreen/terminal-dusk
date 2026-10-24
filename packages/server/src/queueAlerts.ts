// Queues the turn alerts of a move that is already saved. Shared by `submit` and `joinInvite`.
// `keepWaiting` (only `submit` needs it) keeps the alerts of players the move left still waiting.
import { SIDES } from "@terminal-dusk/engine";
import type { HostEffect } from "@terminal-dusk/host";
import { alertsFrom } from "./notifyStore.ts";
import type { NotifyStore } from "./notifyStore.ts";
import type { MatchWrite } from "./store.ts";

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

/**
 * After a saved move: keeps the alert, at the move's new seq, of each player who got no `notify` effect but still
 * has a decision in their new frame (they were waiting before the move and still are). Who is waiting is read
 * from the frames only, never from the secret. Each keep is tried on its own and a failing one is swallowed, like
 * a failing queue: it never changes the caller's outcome, and never throws.
 */
export async function keepWaiting(
  notify: NotifyStore | undefined,
  matchId: string,
  write: Pick<MatchWrite, "record" | "frames">,
  effects: readonly HostEffect[],
): Promise<void> {
  if (notify === undefined) return;
  const notified = new Set(effects.flatMap((effect) => ("notify" in effect ? [effect.notify] : [])));
  for (const side of SIDES) {
    const player = write.record.players[side];
    if (notified.has(player) || write.frames[side].decision === null) continue;
    try {
      await notify.keep(matchId, player, write.record.seq);
    } catch {
      // Nothing to undo: the move stands, and this player's alert may be swept as stale.
    }
  }
}
