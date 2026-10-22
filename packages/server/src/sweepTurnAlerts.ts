// The turn alert sweep (docs/architecture.md, Decision 5, "Scheduled jobs", Notifications): email each
// player whose turn is still waiting and still unseen 20 minutes after its alert was queued, once.
// Plain TypeScript; the scheduled job that calls it is a later task. The email text comes only from
// `turnAlertEmail` and `appUrl`, so it never carries anything from a match.
import type { PlayerId } from "@terminal-dusk/host";
import type { Mailer } from "./mailer.ts";
import { turnAlertEmail } from "./mailMessages.ts";
import type { NotifyStore, TurnAlert } from "./notifyStore.ts";
import type { MatchStore } from "./store.ts";

/** What the sweep needs. `emailOf` gives the player's address, or `null` when there is none. */
export type TurnAlertDeps = {
  notify: NotifyStore;
  store: MatchStore;
  mailer: Mailer;
  emailOf: (player: PlayerId) => string | null | Promise<string | null>;
  appUrl: string;
};

/**
 * One due alert's outcome. `sent`: emailed and marked sent. `stale`: the match moved on, ended or is gone,
 * so it was marked sent without an email. `noAddress`: the player has no address; marked sent, no email.
 * `failed`: something went wrong; the alert stays due for the next sweep.
 */
export type TurnAlertResult = { matchId: string; player: PlayerId; status: "sent" | "stale" | "noAddress" | "failed" };

/**
 * Handles every alert `notify.due(now)` gives, one at a time in that order, and returns one result per
 * alert. One alert's failure never stops the sweep, and the sweep never throws. Running it twice at the
 * same `now` sends nothing the second time.
 */
export async function sweepTurnAlerts(deps: TurnAlertDeps, now: number): Promise<TurnAlertResult[]> {
  const due = await attempt(() => deps.notify.due(now));
  if (!due.ok) return [];
  const results: TurnAlertResult[] = [];
  for (const alert of due.value) {
    const status = await sweepOne(deps, alert, now);
    results.push({ matchId: alert.matchId, player: alert.player, status });
  }
  return results;
}

async function sweepOne(deps: TurnAlertDeps, alert: TurnAlert, now: number): Promise<TurnAlertResult["status"]> {
  const loaded = await attempt(() => deps.store.load(alert.matchId));
  if (!loaded.ok) return "failed";
  const record = loaded.value?.record;
  if (record?.status.kind !== "active" || record.seq !== alert.seq) return markSent(deps, alert, now, "stale");
  const address = await attempt(async () => deps.emailOf(alert.player));
  if (!address.ok) return "failed";
  if (address.value === null) return markSent(deps, alert, now, "noAddress");
  const sent = await attempt(() => deps.mailer.send(turnAlertEmail(address.value as string, deps.appUrl)));
  if (!sent.ok || !sent.value.ok) return "failed";
  return markSent(deps, alert, now, "sent");
}

/** Marks the alert sent and answers `status`, or `failed` when marking throws (the alert stays due). */
async function markSent(
  deps: TurnAlertDeps,
  alert: TurnAlert,
  now: number,
  status: "sent" | "stale" | "noAddress",
): Promise<TurnAlertResult["status"]> {
  const marked = await attempt(() => deps.notify.markSent(alert, now));
  return marked.ok ? status : "failed";
}

/** Runs one call. A throw or a rejection becomes `{ ok: false }`, with none of the thrown text. */
async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false };
  }
}
