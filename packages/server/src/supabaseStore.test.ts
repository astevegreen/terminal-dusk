// SupabaseStore against a stand-in client, so these run without the local stack. The stack tests
// (*.stack.test.ts) prove the same behaviour against the real tables and SQL function.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { matchRowFor } from "./matchRow.ts";
import { rowsFor } from "./rows.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { leaksIn } from "./test/leaks.ts";
import { created, MATCH } from "./test/match.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const FAKE_KEY = "service-key-that-must-not-leak";

/** A stand-in client: every read and rpc gives `answer` (or throws), and every rpc call is kept. */
function fakeClient(answer: Answer | "throws") {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const reply = async () => {
    if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY}`);
    return answer;
  };
  const query = { select: () => query, eq: () => query, maybeSingle: reply };
  const db = {
    from: () => query,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return reply();
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const start = created();
const write = { record: start.record, secret: start.secret, frames: start.frames };
// A database error that quotes the secret, a seed and the key, as a "failing row" detail can.
const quoting: Answer = {
  data: null,
  error: { code: "22P02", message: `bad row ${JSON.stringify(start.secret)}`, details: FAKE_KEY },
};

/** Everything a thrown error shows: its message, its name and any fields it carries. */
const shown = (e: unknown): string =>
  e instanceof Error ? `${e.name} ${e.message} ${JSON.stringify(e)} ${String(e.cause ?? "")}` : String(e);

async function thrown(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected the call to throw");
}

describe("SupabaseStore.load", () => {
  it("gives the record and secret from one row with its secret embedded", async () => {
    const row = { ...matchRowFor(start.record), match_secret: { secret: start.secret } };
    const store = new SupabaseStore(fakeClient({ data: row, error: null }).db);
    expect(await store.load(MATCH)).toEqual({ record: start.record, secret: start.secret });
  });

  it("accepts the embedded secret as a one-row list too", async () => {
    const row = { ...matchRowFor(start.record), match_secret: [{ secret: start.secret }] };
    const store = new SupabaseStore(fakeClient({ data: row, error: null }).db);
    expect(await store.load(MATCH)).toEqual({ record: start.record, secret: start.secret });
  });

  it("gives null for an unknown match", async () => {
    const store = new SupabaseStore(fakeClient({ data: null, error: null }).db);
    expect(await store.load("no-such-match")).toBeNull();
  });

  it.each([null, []])("throws when the match row has no secret row (%j)", async (embedded) => {
    const row = { ...matchRowFor(start.record), match_secret: embedded };
    const store = new SupabaseStore(fakeClient({ data: row, error: null }).db);
    await expect(store.load(MATCH)).rejects.toThrow(/no secret row/);
  });
});

describe("SupabaseStore.commit", () => {
  it("sends O2's rows and the secret to commit_match with the expected seq", async () => {
    const { db, calls } = fakeClient({ data: "saved", error: null });
    expect(await new SupabaseStore(db).commit(MATCH, 0, write)).toBe("saved");
    const rows = rowsFor(write);
    expect(calls).toEqual([
      {
        fn: "commit_match",
        args: {
          p_match_id: MATCH,
          p_expected_seq: 0,
          p_match: rows.match,
          p_secret: start.secret,
          p_views: rows.views,
          p_events: rows.events,
        },
      },
    ]);
  });

  it("gives conflict when the SQL function reports one", async () => {
    const store = new SupabaseStore(fakeClient({ data: "conflict", error: null }).db);
    expect(await store.commit(MATCH, 0, write)).toBe("conflict");
  });

  it("rejects an answer that is neither saved nor conflict", async () => {
    const store = new SupabaseStore(fakeClient({ data: "maybe", error: null }).db);
    await expect(store.commit(MATCH, 0, write)).rejects.toThrow(/unexpected answer/);
  });
});

describe("SupabaseStore: a database error rejects, and no thrown error carries the secret, a seed or the key", () => {
  const cases = [
    ["load", "a database error", quoting],
    ["load", "a client that throws", "throws"],
    ["commit", "a database error", quoting],
    ["commit", "a client that throws", "throws"],
  ] as const;

  it.each(cases)("%s with %s", async (step, _name, answer) => {
    const store = new SupabaseStore(fakeClient(answer).db);
    const error = await thrown(() => (step === "load" ? store.load(MATCH) : store.commit(MATCH, 0, write)));
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(text).toContain(MATCH);
    expect(leaksIn(text, start.secret)).toEqual([]);
    expect(text).not.toContain(FAKE_KEY);
  });
});
