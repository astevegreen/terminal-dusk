// Test helpers for the sweep Edge Function handlers (sweepEdge.ts): one due match and one due turn alert, in
// in-memory stores, with distinctive ids, address and key so a test can check none reaches a reply.
import type { HttpRequest } from "../http.ts";
import { MemoryMailer } from "../mailer.ts";
import { alertsFrom, MemoryNotifyStore, TURN_ALERT_DELAY_MS } from "../notifyStore.ts";
import { MemoryStore } from "../store.ts";
import type { MatchStore } from "../store.ts";
import type { DeadlineStore } from "../deadlineStore.ts";
import type { SweepDeadlinesDeps, SweepTurnAlertsDeps } from "../sweepEdge.ts";
import { withNotify } from "./alerts.ts";
import { createdWithClock, DAY, rulesetFor } from "./deadlines.ts";
import { created, NOW } from "./match.ts";

export const SERVICE_KEY = "service-key-K7QZ-do-not-echo";
export const PLAYERS = { lio: "player-K7QZ-lio", sae: "player-K7QZ-sae" };
export const DEADLINE_MATCH = "match-K7QZ-deadline";
export const ALERT_MATCH = "match-K7QZ-alert";
export const ADDRESS_OF: Record<string, string> = {
  [PLAYERS.lio]: "inbox-K7QZ-lio@mail.test",
  [PLAYERS.sae]: "inbox-K7QZ-sae@mail.test",
};
/** The time the due match's deadlines pass, and the time its queued alerts become due. */
export const DEADLINE_AT = NOW + DAY;
export const ALERT_AT = NOW + TURN_ALERT_DELAY_MS;

/** A plain-data request with the given method and Authorization header. */
export const sweepRequest = (method: string, authorization: string | null = `Bearer ${SERVICE_KEY}`): HttpRequest => ({
  method,
  authorization,
  body: "",
});

export type DeadlineWorld = { store: MemoryStore; deps: SweepDeadlinesDeps; dueCalls: number[] };

/** One lossOnTime match, made at NOW, waiting on both sides, so at DEADLINE_AT both lose on time. */
export function deadlineWorld(now: () => number = () => DEADLINE_AT): DeadlineWorld {
  const store = new MemoryStore();
  const made = createdWithClock(DEADLINE_MATCH, "lossOnTime", NOW, PLAYERS);
  store.insert(DEADLINE_MATCH, { record: made.record, secret: made.secret, frames: made.frames });
  const dueCalls: number[] = [];
  const counted: MatchStore & DeadlineStore = {
    due: (at) => {
      dueCalls.push(at);
      return store.due(at);
    },
    load: (id) => store.load(id),
    commit: (id, seq, write) => store.commit(id, seq, write),
    saveClock: (id, seq, record) => store.saveClock(id, seq, record),
  };
  return { store, dueCalls, deps: { store: counted, rulesetFor, serviceKey: SERVICE_KEY, now } };
}

export type AlertSweepWorld = {
  store: MemoryStore;
  notify: MemoryNotifyStore;
  mailer: MemoryMailer;
  deps: SweepTurnAlertsDeps;
  dueCalls: number[];
};

/** The alert match at seq 0, its first turn alerts queued at NOW, so they are due at ALERT_AT. */
export async function alertSweepWorld(now: () => number = () => ALERT_AT): Promise<AlertSweepWorld> {
  const start = created(ALERT_MATCH, PLAYERS);
  const store = new MemoryStore();
  store.insert(ALERT_MATCH, { record: start.record, secret: start.secret, frames: start.frames });
  const notify = new MemoryNotifyStore();
  const first = alertsFrom(ALERT_MATCH, 0, start.effects, NOW);
  if (first.length === 0) throw new Error("the test match waits for nobody");
  await notify.queue(first);
  const mailer = new MemoryMailer();
  const dueCalls: number[] = [];
  const counted = withNotify(notify, {
    due: (at) => {
      dueCalls.push(at);
      return notify.due(at);
    },
  });
  const alerts = {
    notify: counted,
    store,
    mailer,
    emailOf: (player: string) => ADDRESS_OF[player] ?? null,
    appUrl: "https://play.example.test",
  };
  return { store, notify, mailer, dueCalls, deps: { alerts, serviceKey: SERVICE_KEY, now } };
}
