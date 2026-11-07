// The turn alert sweep (docs/architecture.md, Decision 5, "Scheduled jobs", Notifications): email each
// player whose turn is still waiting and still unseen 20 minutes after its alert was queued, once. A player is
// still waiting when the match is at the alert's `waitingSeq`: its own seq, or a later one `keep` raised it to
// because someone else's move left them still waiting.
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
 * One due alert's outcome. `sent`: claimed, then emailed. `stale`: the match moved on past the alert's
 * `waitingSeq`, ended or is gone, so it was marked sent without an email. `noAddress`: the player has no
 * address; marked sent, no email. `taken`: another sweep running at the same time claimed it first, or since
 * `due` read it a newer alert replaced it (that one stays due) or its match was deleted; no email.
 * `failed`: something went wrong; the alert stays due for the next sweep, except when its claim could not be
 * given back after a failed email (then it is never emailed: one lost email rather than two).
 */
export type TurnAlertResult = {
  matchId: string;
  player: PlayerId;
  status: "sent" | "stale" | "noAddress" | "taken" | "failed";
};

/**
 * Handles every alert `notify.due(now)` gives, one at a time in that order, and returns one result per
 * alert. One alert's failure never stops the sweep, and the sweep never throws. Running it twice at the
 * same `now`, one after the other or at once, sends each alert once: each email waits for its alert's claim.
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

/**
 * One alert. When the match is still active but not at the alert's `waitingSeq`, `keep` may have raised it
 * since `due` read it (the other player's move is saved before `keep` runs), so the sweep re-reads it first:
 * raised, the alert is checked again with the new `waitingSeq`, once; not raised, it is stale. This shrinks
 * the gap in which a still-waiting player loses their email, but does not close it (#309, answer A).
 */
async function sweepOne(
  deps: TurnAlertDeps,
  alert: TurnAlert,
  now: number,
  recheck = true,
): Promise<TurnAlertResult["status"]> {
  const loaded = await attempt(() => deps.store.load(alert.matchId));
  if (!loaded.ok) return "failed";
  const record = loaded.value?.record;
  if (record?.status.kind !== "active") return markSent(deps, alert, now, "stale");
  if (record.seq !== alert.waitingSeq) {
    if (!recheck) return markSent(deps, alert, now, "stale");
    const fresh = await attempt(() => deps.notify.waitingSeq(alert));
    if (!fresh.ok) return "failed";
    if (fresh.value === null || fresh.value <= alert.waitingSeq) return markSent(deps, alert, now, "stale");
    return sweepOne(deps, { ...alert, waitingSeq: fresh.value }, now, false);
  }
  const address = await attempt(async () => deps.emailOf(alert.player));
  if (!address.ok) return "failed";
  if (address.value === null) return markSent(deps, alert, now, "noAddress");
  const claimed = await markSent(deps, alert, now, "sent");
  if (claimed !== "sent") return claimed;
  const sent = await attempt(() => deps.mailer.send(turnAlertEmail(address.value as string, deps.appUrl)));
  if (sent.ok && sent.value.ok) return "sent";
  await attempt(() => deps.notify.release(alert, now));
  return "failed";
}

/**
 * Claims the alert (marks it sent) and answers `status`; `taken` when another sweep marked it first, or
 * `failed` when marking throws (the alert stays due).
 */
async function markSent(
  deps: TurnAlertDeps,
  alert: TurnAlert,
  now: number,
  status: "sent" | "stale" | "noAddress",
): Promise<TurnAlertResult["status"]> {
  const marked = await attempt(() => deps.notify.markSent(alert, now));
  if (!marked.ok) return "failed";
  return marked.value ? status : "taken";
}

/** Runs one call. A throw or a rejection becomes `{ ok: false }`, with none of the thrown text. */
async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false };
  }
}
