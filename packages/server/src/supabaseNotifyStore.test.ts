// SupabaseNotifyStore against a stand-in client, so these run without the local stack.
// supabaseNotifyStore.stack.test.ts proves O8d's store behaviour against the real table and SQL function.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import type { TurnAlert } from "./notifyStore.ts";
import { NotifyStorageError, SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { shown, thrown } from "./test/errors.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
type Call = [string, ...unknown[]];
const FAKE_KEY = "service-key-that-must-not-leak";
const ALICE = "00000000-0000-4000-8000-00000000a11c";
const BOB = "00000000-0000-4000-8000-000000000b0b";
const T = 1_700_000_000_000;
const D = TURN_ALERT_DELAY_MS;
const alert = (matchId: string, player: string, seq: number, queuedAt = T, waitingSeq = seq): TurnAlert => ({
  matchId,
  player,
  seq,
  queuedAt,
  waitingSeq,
});

/** A stand-in client: every query and rpc gives `answer` (or throws) when awaited, and every call is kept. */
function fakeClient(answer: Answer | "throws") {
  const calls: Call[] = [];
  const reply = async () => {
    if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY} for ${ALICE}`);
    return answer;
  };
  const query: Record<string, unknown> = {};
  for (const name of ["select", "update", "eq", "is", "lt", "lte", "order", "maybeSingle"])
    query[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return query;
    };
  query.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => reply().then(resolve, reject);
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(["rpc", fn, args]);
      return reply();
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const ok: Answer = { data: null, error: null };

describe("SupabaseNotifyStore.queue", () => {
  it("sends every alert, in order, to queue_turn_alerts as notify_queue rows, leaving waiting_seq to the function", async () => {
    const { db, calls } = fakeClient(ok);
    await new SupabaseNotifyStore(db).queue([alert("m1", ALICE, 3, T), alert("m1", BOB, 3, T + 1, 9)]);
    expect(calls).toEqual([
      [
        "rpc",
        "queue_turn_alerts",
        {
          p_alerts: [
            { match_id: "m1", player: ALICE, seq: 3, queued_at: T },
            { match_id: "m1", player: BOB, seq: 3, queued_at: T + 1 },
          ],
        },
      ],
    ]);
  });

  it("makes no call when there is nothing to queue", async () => {
    const { db, calls } = fakeClient(ok);
    await new SupabaseNotifyStore(db).queue([]);
    expect(calls).toEqual([]);
  });
});

describe("SupabaseNotifyStore.seen", () => {
  it("sets seen_seq on the player's row for the match, only where its seq is at most the seen seq", async () => {
    const { db, calls } = fakeClient(ok);
    await new SupabaseNotifyStore(db).seen("m1", ALICE, 4);
    expect(calls).toEqual([
      ["from", "notify_queue"],
      ["update", { seen_seq: 4 }],
      ["eq", "match_id", "m1"],
      ["eq", "player", ALICE],
      ["lte", "seq", 4],
    ]);
  });
});

describe("SupabaseNotifyStore.keep", () => {
  it("sets waiting_seq on the player's row for the match, only where it is unsent and its waiting_seq is lower", async () => {
    const { db, calls } = fakeClient(ok);
    await new SupabaseNotifyStore(db).keep("m1", ALICE, 4);
    expect(calls).toEqual([
      ["from", "notify_queue"],
      ["update", { waiting_seq: 4 }],
      ["eq", "match_id", "m1"],
      ["eq", "player", ALICE],
      ["is", "sent_at", null],
      ["lt", "waiting_seq", 4],
    ]);
  });
});

describe("SupabaseNotifyStore.due", () => {
  it("asks for rows not seen, not sent and queued at least 20 minutes ago, by queued_at, match_id, player", async () => {
    const rows = [
      { match_id: "m1", player: ALICE, seq: 2, queued_at: T, waiting_seq: 4 },
      { match_id: "m2", player: BOB, seq: 5, queued_at: T + 1, waiting_seq: 5 },
    ];
    const { db, calls } = fakeClient({ data: rows, error: null });
    expect(await new SupabaseNotifyStore(db).due(T + D + 1)).toEqual([
      alert("m1", ALICE, 2, T, 4),
      alert("m2", BOB, 5, T + 1),
    ]);
    expect(calls).toEqual([
      ["from", "notify_queue"],
      ["select", "match_id, player, seq, queued_at, waiting_seq"],
      ["is", "seen_seq", null],
      ["is", "sent_at", null],
      ["lte", "queued_at", T + 1],
      ["order", "queued_at", { ascending: true }],
      ["order", "match_id", { ascending: true }],
      ["order", "player", { ascending: true }],
    ]);
  });

  it("gives no alerts when nothing is due", async () => {
    expect(await new SupabaseNotifyStore(fakeClient({ data: [], error: null }).db).due(T)).toEqual([]);
  });
});

describe("SupabaseNotifyStore.markSent", () => {
  it("sets sent_at on the player's row for the match, only where the seq is the alert's", async () => {
    const { db, calls } = fakeClient(ok);
    await new SupabaseNotifyStore(db).markSent(alert("m1", ALICE, 2), T + D);
    expect(calls).toEqual([
      ["from", "notify_queue"],
      ["update", { sent_at: T + D }],
      ["eq", "match_id", "m1"],
      ["eq", "player", ALICE],
      ["eq", "seq", 2],
    ]);
  });
});

describe("SupabaseNotifyStore.waitingSeq", () => {
  it("reads waiting_seq from the player's row for the match, only where the seq is the alert's and it is unsent", async () => {
    const { db, calls } = fakeClient({ data: { waiting_seq: 4 }, error: null });
    expect(await new SupabaseNotifyStore(db).waitingSeq(alert("m1", ALICE, 2))).toBe(4);
    expect(calls).toEqual([
      ["from", "notify_queue"],
      ["select", "waiting_seq"],
      ["eq", "match_id", "m1"],
      ["eq", "player", ALICE],
      ["eq", "seq", 2],
      ["is", "sent_at", null],
      ["maybeSingle"],
    ]);
  });

  it("gives null when no such row is found", async () => {
    const store = new SupabaseNotifyStore(fakeClient({ data: null, error: null }).db);
    expect(await store.waitingSeq(alert("m1", ALICE, 2))).toBeNull();
  });

  it("rejects when the row has no whole-number waiting_seq", async () => {
    const store = new SupabaseNotifyStore(fakeClient({ data: { waiting_seq: "4" }, error: null }).db);
    expect(shown(await thrown(() => store.waitingSeq(alert("m1", ALICE, 2))))).toContain("waitingSeq");
  });
});

describe("SupabaseNotifyStore: a database error rejects with a storage error that shows no row data", () => {
  // A database error that quotes a row, a player id and the key, as a "failing row" detail can.
  const quoting: Answer = {
    data: null,
    error: { code: "22P02", message: `bad row (m1, ${ALICE}, 2, ${T})`, details: FAKE_KEY },
  };
  const steps = {
    queue: (store: SupabaseNotifyStore) => store.queue([alert("m1", ALICE, 2)]),
    seen: (store: SupabaseNotifyStore) => store.seen("m1", ALICE, 2),
    keep: (store: SupabaseNotifyStore) => store.keep("m1", ALICE, 3),
    due: (store: SupabaseNotifyStore) => store.due(T + D),
    markSent: (store: SupabaseNotifyStore) => store.markSent(alert("m1", ALICE, 2), T + D),
    waitingSeq: (store: SupabaseNotifyStore) => store.waitingSeq(alert("m1", ALICE, 2)),
  };
  const cases = Object.keys(steps).flatMap((step) => [
    [step, "a database error", quoting] as const,
    [step, "a client that throws", "throws"] as const,
  ]);

  it.each(cases)("%s with %s", async (step, _name, answer) => {
    const store = new SupabaseNotifyStore(fakeClient(answer).db);
    const error = await thrown(() => steps[step as keyof typeof steps](store));
    expect(error).toBeInstanceOf(NotifyStorageError);
    const text = shown(error);
    expect(text).toContain(step);
    if (answer !== "throws") expect(text).toContain("database error 22P02");
    for (const hidden of [ALICE, FAKE_KEY, "bad row", String(T)]) expect(text).not.toContain(hidden);
  });

  it("names the match for seen, keep, markSent and waitingSeq, which are about one match", async () => {
    const store = new SupabaseNotifyStore(fakeClient(quoting).db);
    expect(shown(await thrown(() => steps.seen(store)))).toContain("match m1");
    expect(shown(await thrown(() => steps.keep(store)))).toContain("match m1");
    expect(shown(await thrown(() => steps.markSent(store)))).toContain("match m1");
    expect(shown(await thrown(() => steps.waitingSeq(store)))).toContain("match m1");
  });

  it("rejects when due gets an answer that is not a list of rows", async () => {
    const store = new SupabaseNotifyStore(fakeClient({ data: null, error: null }).db);
    expect(shown(await thrown(() => store.due(T)))).toContain("due");
  });
});
