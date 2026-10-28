// SupabaseStore's DeadlineStore side (due, saveClock) and the clock on load, against a stand-in client, so
// these run without the local stack. supabaseStore.deadlines.stack.test.ts proves the same on the real tables.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { matchRowFor } from "./matchRow.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { shown, thrown } from "./test/errors.ts";
import { leaksIn } from "@terminal-dusk/host/test/secret-leaks";
import { createdWithClock, DAY } from "./test/deadlines.ts";
import { MATCH, NOW } from "./test/match.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
type Call = [string, ...unknown[]];
const FAKE_KEY = "service-key-that-must-not-leak";

/** A stand-in client: every query gives `answer` (or throws) when awaited, and every builder call is kept. */
function fakeClient(answer: Answer | "throws") {
  const calls: Call[] = [];
  const reply = async () => {
    if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY}`);
    return answer;
  };
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "lte", "order", "update"])
    query[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return query;
    };
  query.maybeSingle = reply;
  query.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => reply().then(resolve, reject);
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const start = createdWithClock(MATCH, "graceThenLoss", NOW);
const later = {
  ...start.record,
  updatedAt: NOW + 7,
  clock: { ...start.record.clock!, graceUsed: { lio: true, sae: false } },
};

describe("SupabaseStore.load with a clock", () => {
  it("gives back the record's clock exactly", async () => {
    const row = { ...matchRowFor(start.record), match_secret: { secret: start.secret } };
    const loaded = await new SupabaseStore(fakeClient({ data: row, error: null }).db).load(MATCH);
    expect(loaded?.record.clock).toEqual(start.record.clock);
    expect(loaded).toEqual({ record: start.record, secret: start.secret });
  });

  it("reads the clock column", async () => {
    const { db, calls } = fakeClient({ data: null, error: null });
    await new SupabaseStore(db).load(MATCH);
    const select = calls.find((c) => c[0] === "select")!;
    expect(String(select[1]).split(/,\s*/)).toContain("clock");
  });
});

describe("SupabaseStore.due", () => {
  it("asks for active matches with next_deadline at or before now, by next_deadline then match_id, and gives their ids", async () => {
    const { db, calls } = fakeClient({ data: [{ match_id: "m-a" }, { match_id: "m-b" }], error: null });
    expect(await new SupabaseStore(db).due(NOW + DAY)).toEqual(["m-a", "m-b"]);
    expect(calls).toEqual([
      ["from", "match"],
      ["select", "match_id"],
      ["lte", "next_deadline", NOW + DAY],
      ["eq", "status->>kind", "active"],
      ["order", "next_deadline", { ascending: true }],
      ["order", "match_id", { ascending: true }],
    ]);
  });

  it("gives no ids when nothing is due", async () => {
    expect(await new SupabaseStore(fakeClient({ data: [], error: null }).db).due(NOW)).toEqual([]);
  });
});

describe("SupabaseStore.saveClock", () => {
  it("updates only clock, next_deadline and updated_at of the match row, where the seq is the expected one", async () => {
    const { db, calls } = fakeClient({ data: [{ match_id: MATCH }], error: null });
    expect(await new SupabaseStore(db).saveClock(MATCH, 0, later)).toBe("saved");
    const row = matchRowFor(later);
    expect(calls).toEqual([
      ["from", "match"],
      ["update", { clock: row.clock, next_deadline: row.next_deadline, updated_at: NOW + 7 }],
      ["eq", "match_id", MATCH],
      ["eq", "seq", 0],
      ["select", "match_id"],
    ]);
  });

  it("gives conflict when no row had the expected seq", async () => {
    const store = new SupabaseStore(fakeClient({ data: [], error: null }).db);
    expect(await store.saveClock(MATCH, 3, later)).toBe("conflict");
  });
});

describe("SupabaseStore deadlines: a database error rejects, showing no secret, seed or key", () => {
  const quoting: Answer = {
    data: null,
    error: { code: "22P02", message: `bad row ${JSON.stringify(start.secret)}`, details: FAKE_KEY },
  };
  const cases = [
    ["due", "a database error", quoting],
    ["due", "a client that throws", "throws"],
    ["saveClock", "a database error", quoting],
    ["saveClock", "a client that throws", "throws"],
  ] as const;

  it.each(cases)("%s with %s", async (step, _name, answer) => {
    const store = new SupabaseStore(fakeClient(answer).db);
    const error = await thrown(() => (step === "due" ? store.due(NOW) : store.saveClock(MATCH, 0, later)));
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(text).toContain(step);
    if (step === "saveClock") expect(text).toContain(MATCH);
    expect(leaksIn(text, start.secret)).toEqual([]);
    expect(text).not.toContain(FAKE_KEY);
  });
});
