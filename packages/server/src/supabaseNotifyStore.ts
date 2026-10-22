// The Supabase side of the turn alert queue (docs/architecture.md, Decision 5, `notify_queue`). It runs only
// with a client made with the service role key: clients can neither read `notify_queue` nor run
// `queue_turn_alerts`. No error it throws carries a row, a player id or a key, so it can be logged.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerId } from "@terminal-dusk/host";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { NotifyStore, TurnAlert } from "./notifyStore.ts";

/** The `notify_queue` columns that make up a `TurnAlert`. */
type AlertRow = { match_id: string; player: PlayerId; seq: number; queued_at: number };

const ALERT_COLUMNS = "match_id, player, seq, queued_at";

type Step = "queue" | "seen" | "due" | "markSent";

/**
 * A turn alert storage failure. Its message names only the step, the match id (for a step about one match)
 * and the database's error code: never a player id, or the database's own message or details, which may quote
 * a row.
 */
export class NotifyStorageError extends Error {
  constructor(step: Step, matchId: string | null, reason: string) {
    super(`Turn alert ${step} failed${matchId === null ? "" : ` for match ${matchId}`}: ${reason}.`);
    this.name = "NotifyStorageError";
  }
}

const reasonOf = (error: { code?: string } | null | undefined): string =>
  error?.code ? `database error ${error.code}` : "the database did not answer";

/** Runs one database call; a thrown network failure or a database error becomes a `NotifyStorageError`. */
async function call<T>(
  step: Step,
  matchId: string | null,
  run: () => PromiseLike<{ data: T; error: { code?: string } | null }>,
): Promise<T> {
  let answer;
  try {
    answer = await run();
  } catch {
    throw new NotifyStorageError(step, matchId, "the database did not answer");
  }
  if (answer.error) throw new NotifyStorageError(step, matchId, reasonOf(answer.error));
  return answer.data;
}

/** A `NotifyStore` over the `notify_queue` table, with O8d's `MemoryNotifyStore` behaviour. */
export class SupabaseNotifyStore implements NotifyStore {
  readonly #db: SupabaseClient;

  /** `db` must be made with the service role key. */
  constructor(db: SupabaseClient) {
    this.#db = db;
  }

  /** One call to `queue_turn_alerts`, which keeps the newest seq per (match, player) as a fresh alert. */
  async queue(alerts: TurnAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    const p_alerts: AlertRow[] = alerts.map((a) => ({
      match_id: a.matchId,
      player: a.player,
      seq: a.seq,
      queued_at: a.queuedAt,
    }));
    await call("queue", null, () => this.#db.rpc("queue_turn_alerts", { p_alerts }));
  }

  async seen(matchId: string, player: PlayerId, seq: number): Promise<void> {
    await call("seen", matchId, () =>
      this.#db
        .from("notify_queue")
        .update({ seen_seq: seq })
        .eq("match_id", matchId)
        .eq("player", player)
        .lte("seq", seq),
    );
  }

  async due(now: number): Promise<TurnAlert[]> {
    const data = await call("due", null, () =>
      this.#db
        .from("notify_queue")
        .select(ALERT_COLUMNS)
        .is("seen_seq", null)
        .is("sent_at", null)
        .lte("queued_at", now - TURN_ALERT_DELAY_MS)
        .order("queued_at", { ascending: true })
        .order("match_id", { ascending: true })
        .order("player", { ascending: true }),
    );
    if (!Array.isArray(data)) throw new NotifyStorageError("due", null, "the database gave an unexpected answer");
    return (data as AlertRow[]).map((row) => ({
      matchId: row.match_id,
      player: row.player,
      seq: row.seq,
      queuedAt: row.queued_at,
    }));
  }

  async markSent(alert: TurnAlert, now: number): Promise<void> {
    await call("markSent", alert.matchId, () =>
      this.#db
        .from("notify_queue")
        .update({ sent_at: now })
        .eq("match_id", alert.matchId)
        .eq("player", alert.player)
        .eq("seq", alert.seq),
    );
  }
}
