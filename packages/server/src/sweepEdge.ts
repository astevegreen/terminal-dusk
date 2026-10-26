// The sweep Edge Functions' handlers (docs/architecture.md, Decision 5, "Scheduled jobs"): `sweep-deadlines`
// runs `sweepDeadlines` and `sweep-turn-alerts` runs `sweepTurnAlerts` when the scheduled job calls them. Only
// the server may call them, so a call must present the service role key. Kept here, not in the Deno entries,
// so every decision is tested. The reply holds only counts: never a match id, player id, address or the key.
import type { Ruleset, RulesetId } from "@terminal-dusk/engine";
import type { DeadlineStore } from "./deadlineStore.ts";
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import type { HttpReply, HttpRequest } from "./http.ts";
import type { MatchStore } from "./store.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import type { SweepResult } from "./sweepDeadlines.ts";
import { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
import type { TurnAlertDeps, TurnAlertResult } from "./sweepTurnAlerts.ts";
import { sameText } from "./webhookSignature.ts";

/** What every sweep handler needs: the service role key a caller must present, and the clock. */
export type SweepAccess = { serviceKey: string; now: () => number };
export type SweepDeadlinesDeps = SweepAccess & {
  store: MatchStore & DeadlineStore;
  rulesetFor: (id: RulesetId) => Ruleset | null;
};
export type SweepTurnAlertsDeps = SweepAccess & { alerts: TurnAlertDeps };

/** Every status each sweep can give, in the order the reply lists them. */
export const DEADLINE_STATUSES = ["extended", "timedOut", "conflict", "skipped"] as const;
export const TURN_ALERT_STATUSES = ["sent", "stale", "noAddress", "failed"] as const;

type Counts<S extends string> = Record<S, number>;

/** The plain-data `sweep-deadlines` handler: 200 with `{ results: <count of each status> }`, or a refusal. */
export function handleSweepDeadlines(deps: SweepDeadlinesDeps, request: HttpRequest): Promise<HttpReply> {
  const run = (now: number): Promise<SweepResult[]> => sweepDeadlines(deps.store, deps.rulesetFor, now);
  return handleSweep(deps, request, DEADLINE_STATUSES, run);
}

/** The plain-data `sweep-turn-alerts` handler: 200 with `{ results: <count of each status> }`, or a refusal. */
export function handleSweepTurnAlerts(deps: SweepTurnAlertsDeps, request: HttpRequest): Promise<HttpReply> {
  const run = (now: number): Promise<TurnAlertResult[]> => sweepTurnAlerts(deps.alerts, now);
  return handleSweep(deps, request, TURN_ALERT_STATUSES, run);
}

/** A fetch-style handler around `handleSweepDeadlines`. */
export function sweepDeadlinesFetchHandler<R>(
  deps: SweepDeadlinesDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleSweepDeadlines(deps, request), respond);
}

/** A fetch-style handler around `handleSweepTurnAlerts`. */
export function sweepTurnAlertsFetchHandler<R>(
  deps: SweepTurnAlertsDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleSweepTurnAlerts(deps, request), respond);
}

/**
 * Only POST (else 405), only with `Authorization: Bearer <service role key>` exactly (else 401), only with a
 * clock giving a whole number 0 or more (else 500). Then runs the sweep once and counts its results. Never throws.
 */
async function handleSweep<S extends string>(
  access: SweepAccess,
  request: HttpRequest,
  statuses: readonly S[],
  run: (now: number) => Promise<readonly { status: S }[]>,
): Promise<HttpReply> {
  try {
    if (request.method !== "POST") return refuse(405, "methodNotAllowed", "Only POST is accepted.");
    if (!authorized(access.serviceKey, request.authorization)) {
      return refuse(401, "notAuthorized", "This function needs the service role key.");
    }
    const now = access.now();
    if (typeof now !== "number" || !Number.isSafeInteger(now) || now < 0) {
      return refuse(500, "badClock", "The server clock gave an unusable time.");
    }
    return json(200, { results: countOf(statuses, await run(now)) });
  } catch {
    return refuse(500, "sweepFailed", "The sweep could not run.");
  }
}

/** Whether `authorization` is exactly `Bearer <key>`, compared without an early exit. An empty key refuses all. */
function authorized(key: string, authorization: string | null): boolean {
  if (typeof key !== "string" || key.length === 0 || typeof authorization !== "string") return false;
  return sameText(authorization, `Bearer ${key}`);
}

/** How many results have each status, with every status present (0 when none). */
function countOf<S extends string>(statuses: readonly S[], results: readonly { status: S }[]): Counts<S> {
  const counts = Object.fromEntries(statuses.map((s) => [s, 0])) as Counts<S>;
  for (const { status } of results) if (statuses.includes(status)) counts[status] += 1;
  return counts;
}

const json = (status: number, body: unknown): HttpReply => ({
  status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const refuse = (status: number, code: string, message: string): HttpReply =>
  json(status, { ok: false, error: { code, message } });
