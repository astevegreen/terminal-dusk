// The online game's deadline (docs/architecture.md, Decision 5, "Deadlines"): reads the `clock` column of the
// match's `match` row (only that column, never the seed) and works out which side's deadline to show for a
// frame. The clock is display data only; the server's deadline sweep decides what a missed deadline does.
import type { Side } from "@terminal-dusk/engine";
import type { DeadlineRule, Frame, MatchClock } from "@terminal-dusk/host";
import type { FetchLike } from "../transport/remoteHttp.ts";

/** The deadline the screen shows: whose it is, when it falls, the match's rule, and the time it was read. */
export type OnlineDeadline = {
  side: Side;
  /** When `side` must answer, in whole milliseconds since 1970. */
  at: number;
  rule: DeadlineRule;
  days: 1 | 3 | 7;
  /** True only for `graceThenLoss` when `side` has not had its extension yet. */
  graceLeft: boolean;
  /** The injected `now()` at the read. */
  now: number;
};

export type ClockEndpoint = { url: string; anonKey: string; matchId: string; fetch: FetchLike };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isSideRecord = <T>(v: unknown, ok: (x: unknown) => x is T): v is Record<Side, T> =>
  isObject(v) && ok(v.lio) && ok(v.sae);
const isDeadline = (x: unknown): x is number | null => x === null || (typeof x === "number" && Number.isSafeInteger(x));
const isBool = (x: unknown): x is boolean => typeof x === "boolean";

/** The clock when `v` is a well-formed one, else undefined. */
function parseClock(v: unknown): MatchClock | undefined {
  if (!isObject(v)) return undefined;
  const { rule, days, deadlines, graceUsed } = v;
  if (rule !== "lossOnTime" && rule !== "graceThenLoss") return undefined;
  if (days !== 1 && days !== 3 && days !== 7) return undefined;
  if (!isSideRecord(deadlines, isDeadline) || !isSideRecord(graceUsed, isBool)) return undefined;
  return {
    rule,
    days,
    deadlines: { lio: deadlines.lio, sae: deadlines.sae },
    graceUsed: { lio: graceUsed.lio, sae: graceUsed.sae },
  };
}

/**
 * Reads the match row's clock: the clock, null when the row has none, or undefined when the read failed or
 * the reply was malformed. It never throws.
 */
export async function readClock(e: ClockEndpoint, token: string | null): Promise<MatchClock | null | undefined> {
  try {
    const query = `select=clock&match_id=eq.${encodeURIComponent(e.matchId)}`;
    const reply = await e.fetch(`${e.url}/rest/v1/match?${query}`, {
      method: "GET",
      headers: {
        apikey: e.anonKey,
        Accept: "application/json",
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
    });
    if (!reply.ok) return undefined;
    const rows = await reply.json();
    if (!Array.isArray(rows) || !isObject(rows[0])) return undefined;
    const clock: unknown = rows[0].clock;
    return clock === null || clock === undefined ? null : parseClock(clock);
  } catch {
    return undefined;
  }
}

/**
 * The deadline to show for `frame`: the viewer's own when the frame has a decision for them (this covers both
 * sides waited on at once), else the side the public view's pending decision waits on. Null when the game is
 * over, nobody is waited on, or that side has no deadline.
 */
export function deadlineFor(clock: MatchClock | null, frame: Frame, now: number): OnlineDeadline | null {
  if (clock === null || frame.view.public.status.kind === "over") return null;
  const side = frame.decision !== null ? frame.decision.side : frame.view.public.pending[0]?.side;
  if (side === undefined) return null;
  const at = clock.deadlines[side];
  if (at === null) return null;
  const graceLeft = clock.rule === "graceThenLoss" && !clock.graceUsed[side];
  return { side, at, rule: clock.rule, days: clock.days, graceLeft, now };
}
