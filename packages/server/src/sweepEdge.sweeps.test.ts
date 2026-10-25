import { describe, expect, it } from "vitest";
import type { FetchRequest } from "./edge.ts";
import type { HttpReply } from "./http.ts";
import { MemoryStore } from "./store.ts";
import {
  handleSweepDeadlines,
  handleSweepTurnAlerts,
  sweepDeadlinesFetchHandler,
  sweepTurnAlertsFetchHandler,
} from "./sweepEdge.ts";
import { withNotify } from "./test/alerts.ts";
import { SEED } from "./test/match.ts";
import {
  ADDRESS_OF,
  ALERT_MATCH,
  alertSweepWorld,
  DEADLINE_MATCH,
  deadlineWorld,
  PLAYERS,
  SERVICE_KEY,
  sweepRequest,
} from "./test/sweeps.ts";

const resultsOf = (reply: HttpReply): unknown => JSON.parse(reply.body);
const ZERO_DEADLINES = { extended: 0, timedOut: 0, conflict: 0, skipped: 0 };
const ZERO_ALERTS = { sent: 0, stale: 0, noAddress: 0, failed: 0 };
const failure = () => Promise.reject(new Error(`database down at ${DEADLINE_MATCH} ${ALERT_MATCH}`));

/** Checks the reply holds none of the match ids, player ids, addresses, seed or key. */
function expectNothingPrivate(reply: HttpReply): void {
  const text = JSON.stringify(reply);
  for (const secret of [DEADLINE_MATCH, ALERT_MATCH, ...Object.values(PLAYERS), ...Object.values(ADDRESS_OF)]) {
    expect(text).not.toContain(secret);
  }
  expect(text).not.toContain(SEED);
  expect(text).not.toContain(SERVICE_KEY);
  expect(text).not.toContain("K7QZ");
}

describe("sweep-deadlines handler: running the deadline sweep", () => {
  it("a due match is timed out through a POST with the right key: 200 with every status counted", async () => {
    const w = deadlineWorld();
    const reply = await handleSweepDeadlines(w.deps, sweepRequest("POST"));
    expect(reply.status).toBe(200);
    expect(resultsOf(reply)).toEqual({ results: { ...ZERO_DEADLINES, timedOut: 1 } });
    expect(w.store.stored(DEADLINE_MATCH)?.record.status.kind).toBe("over");
  });

  it("a second call at the same time changes nothing: 200 with all zeros", async () => {
    const w = deadlineWorld();
    await handleSweepDeadlines(w.deps, sweepRequest("POST"));
    const after = JSON.stringify(w.store.stored(DEADLINE_MATCH));
    const again = await handleSweepDeadlines(w.deps, sweepRequest("POST"));
    expect(resultsOf(again)).toEqual({ results: ZERO_DEADLINES });
    expect(JSON.stringify(w.store.stored(DEADLINE_MATCH))).toBe(after);
  });

  it("a storage failure in due is still 200 with all zeros", async () => {
    const w = deadlineWorld();
    const reply = await handleSweepDeadlines(
      { ...w.deps, store: { ...w.deps.store, due: failure } },
      sweepRequest("POST"),
    );
    expect(reply.status).toBe(200);
    expect(resultsOf(reply)).toEqual({ results: ZERO_DEADLINES });
  });

  it("nothing due: 200 with all zeros", async () => {
    const w = deadlineWorld();
    const reply = await handleSweepDeadlines({ ...w.deps, store: new MemoryStore() }, sweepRequest("POST"));
    expect(resultsOf(reply)).toEqual({ results: ZERO_DEADLINES });
  });

  it("the reply never contains match ids, player ids, seeds or the key, whatever the outcome", async () => {
    const w = deadlineWorld();
    for (const request of [
      sweepRequest("POST"),
      sweepRequest("POST"),
      sweepRequest("GET"),
      sweepRequest("POST", null),
    ]) {
      expectNothingPrivate(await handleSweepDeadlines(w.deps, request));
    }
  });
});

describe("sweep-turn-alerts handler: running the turn alert sweep", () => {
  it("a due unseen alert is emailed once through a POST with the right key: 200 with every status counted", async () => {
    const w = await alertSweepWorld();
    const reply = await handleSweepTurnAlerts(w.deps, sweepRequest("POST"));
    expect(reply.status).toBe(200);
    const waiting = w.mailer.sent.length;
    expect(waiting).toBeGreaterThan(0);
    expect(resultsOf(reply)).toEqual({ results: { ...ZERO_ALERTS, sent: waiting } });
    const to = w.mailer.sent.map((e) => e.to);
    expect(new Set(to).size).toBe(to.length);
    for (const address of to) expect(Object.values(ADDRESS_OF)).toContain(address);
  });

  it("a second call at the same time sends nothing: 200 with all zeros", async () => {
    const w = await alertSweepWorld();
    await handleSweepTurnAlerts(w.deps, sweepRequest("POST"));
    const sent = w.mailer.sent.length;
    const again = await handleSweepTurnAlerts(w.deps, sweepRequest("POST"));
    expect(resultsOf(again)).toEqual({ results: ZERO_ALERTS });
    expect(w.mailer.sent).toHaveLength(sent);
  });

  it("a failed send is counted as failed and the alert stays due", async () => {
    const w = await alertSweepWorld();
    const due = (await w.notify.due(Number.MAX_SAFE_INTEGER)).length;
    for (let i = 0; i < due; i++) w.mailer.failNext("unavailable");
    const reply = await handleSweepTurnAlerts(w.deps, sweepRequest("POST"));
    expect(resultsOf(reply)).toEqual({ results: { ...ZERO_ALERTS, failed: due } });
    expect(await w.notify.due(Number.MAX_SAFE_INTEGER)).toHaveLength(due);
  });

  it("a storage failure in due is still 200 with all zeros", async () => {
    const w = await alertSweepWorld();
    const notify = withNotify(w.notify, { due: failure });
    const reply = await handleSweepTurnAlerts(
      { ...w.deps, alerts: { ...w.deps.alerts, notify } },
      sweepRequest("POST"),
    );
    expect(reply.status).toBe(200);
    expect(resultsOf(reply)).toEqual({ results: ZERO_ALERTS });
  });

  it("the reply never contains match ids, player ids, email addresses, seeds or the key", async () => {
    const w = await alertSweepWorld();
    const first = await handleSweepTurnAlerts(w.deps, sweepRequest("POST"));
    expect(w.mailer.sent.length).toBeGreaterThan(0);
    expectNothingPrivate(first);
    for (const request of [sweepRequest("POST"), sweepRequest("PUT"), sweepRequest("POST", "Bearer nope")]) {
      expectNothingPrivate(await handleSweepTurnAlerts(w.deps, request));
    }
  });
});

describe("sweep Edge Function glue: fetch requests to the handlers and back", () => {
  type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
  const make = (body: string | null, init: Made["init"]): Made => ({ body, init });
  const request = (method: string, headers: Record<string, string>): FetchRequest => ({
    method,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => "",
  });

  it("passes the method and the Authorization header through and makes a JSON response", async () => {
    const w = deadlineWorld();
    const made = await sweepDeadlinesFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: `Bearer ${SERVICE_KEY}` }));
    expect(made.init.status).toBe(200);
    expect(made.init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(made.body!)).toEqual({ results: { ...ZERO_DEADLINES, timedOut: 1 } });
  });

  it("a request whose headers cannot be read is 401 and runs nothing", async () => {
    const w = await alertSweepWorld();
    const broken: FetchRequest = {
      method: "POST",
      headers: {
        get: () => {
          throw new Error("headers broke");
        },
      },
      text: async () => "",
    };
    const made = await sweepTurnAlertsFetchHandler(w.deps, make)(broken);
    expect(made.init.status).toBe(401);
    expect(w.dueCalls).toEqual([]);
  });
});
