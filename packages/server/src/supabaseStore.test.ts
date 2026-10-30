// SupabaseStore against a stand-in client, so these run without the local stack. The stack tests in
// src/migrations prove the same store against the real tables and SQL function.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { rowsFor } from "./rows.ts";
import { COMMIT_FUNCTION, SupabaseStore } from "./supabaseStore.ts";
import { leaksIn } from "./test/leaks.ts";
import { created, MATCH, SEED } from "./test/match.ts";

type Reply = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
type Calls = { from: string[]; select: string[]; eq: [string, unknown][]; rpc: [string, unknown][] };

/** A stand-in client: `from(...).select(...).eq(...).maybeSingle()` and `rpc(...)` answer with the given replies. */
function fakeClient(load: () => Promise<Reply>, rpc: () => Promise<Reply> = load) {
  const calls: Calls = { from: [], select: [], eq: [], rpc: [] };
  const query = {
    select(columns: string) {
      calls.select.push(columns);
      return query;
    },
    eq(column: string, value: unknown) {
      calls.eq.push([column, value]);
      return query;
    },
    maybeSingle: load,
  };
  const db = {
    from(table: string) {
      calls.from.push(table);
      return query;
    },
    rpc(name: string, args: unknown) {
      calls.rpc.push([name, args]);
      return rpc();
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const reply =
  (data: unknown, error: Reply["error"] = null) =>
  async (): Promise<Reply> => ({ data, error });
const start = created();
const storedRow = () => ({ ...rowsFor(start).match, match_secret: { secret: start.secret } });
/** Database text that quotes the secret, the way a constraint error can quote a whole row. */
const noisy = { code: "23505", message: `Failing row contains ${JSON.stringify(start.secret)}`, details: SEED };

async function thrownBy(call: () => Promise<unknown>): Promise<Error> {
  try {
    await call();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected a throw");
}

/** Everything a thrown error shows: its message and every field it carries. */
const shown = (error: Error) => `${error.message} ${JSON.stringify(error)} ${JSON.stringify(error.cause ?? null)}`;

describe("SupabaseStore.load", () => {
  it("reads the match and its secret in one query and returns the record and the secret", async () => {
    const { db, calls } = fakeClient(reply(storedRow()));
    const loaded = await new SupabaseStore(db).load(MATCH);
    expect(loaded).toEqual({ record: start.record, secret: start.secret });
    expect(calls.from).toEqual(["match"]);
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toContain("match_secret(secret)");
    expect(calls.eq).toEqual([["match_id", MATCH]]);
  });

  it("accepts the secret embedded as a one-row list too", async () => {
    const { db } = fakeClient(reply({ ...storedRow(), match_secret: [{ secret: start.secret }] }));
    expect(await new SupabaseStore(db).load(MATCH)).toEqual({ record: start.record, secret: start.secret });
  });

  it("returns null for an unknown match", async () => {
    const { db } = fakeClient(reply(null));
    expect(await new SupabaseStore(db).load(MATCH)).toBeNull();
  });

  it.each([
    ["no secret row", null],
    ["an empty list", []],
  ])("throws when the match row has %s, so submit answers storageFailed, not matchNotFound", async (_, embedded) => {
    const { db } = fakeClient(reply({ ...storedRow(), match_secret: embedded }));
    const error = await thrownBy(() => new SupabaseStore(db).load(MATCH));
    expect(error.message).toContain("secret row");
  });

  it("throws on a database error, with none of the database's text", async () => {
    const { db } = fakeClient(reply(null, noisy));
    const error = await thrownBy(() => new SupabaseStore(db).load(MATCH));
    expect(error.message).toContain("23505");
    expect(leaksIn(shown(error), start.secret)).toEqual([]);
    expect(shown(error)).not.toContain("Failing row");
  });

  it("throws when the client itself throws, with none of the thrown text", async () => {
    const { db } = fakeClient(() => Promise.reject(new Error(`network down: ${SEED}`)));
    const error = await thrownBy(() => new SupabaseStore(db).load(MATCH));
    expect(shown(error)).not.toContain("network down");
    expect(leaksIn(shown(error), start.secret)).toEqual([]);
  });
});

describe("SupabaseStore.commit", () => {
  const write = { record: start.record, secret: start.secret, frames: start.frames };

  it("calls the SQL function once with the expected seq, the secret and O2's rows for the write", async () => {
    const { db, calls } = fakeClient(reply(true));
    expect(await new SupabaseStore(db).commit(MATCH, 4, write)).toBe("saved");
    const rows = rowsFor(write);
    expect(calls.rpc).toEqual([
      [
        COMMIT_FUNCTION,
        {
          p_match_id: MATCH,
          p_expected_seq: 4,
          p_match: rows.match,
          p_secret: start.secret,
          p_views: rows.views,
          p_events: rows.events,
        },
      ],
    ]);
  });

  it("returns conflict when the SQL function reports that no row matched", async () => {
    const { db } = fakeClient(reply(false));
    expect(await new SupabaseStore(db).commit(MATCH, 0, write)).toBe("conflict");
  });

  it("rejects on a database error, with none of the database's text", async () => {
    const { db } = fakeClient(reply(null, noisy));
    const error = await thrownBy(() => new SupabaseStore(db).commit(MATCH, 0, write));
    expect(leaksIn(shown(error), start.secret)).toEqual([]);
    expect(shown(error)).not.toContain("Failing row");
  });

  it("rejects when the client itself throws, with none of the thrown text", async () => {
    const { db } = fakeClient(() => Promise.reject(new Error(`network down: ${SEED}`)));
    const error = await thrownBy(() => new SupabaseStore(db).commit(MATCH, 0, write));
    expect(shown(error)).not.toContain("network down");
  });

  it("rejects when the SQL function answers anything but true or false", async () => {
    const { db } = fakeClient(reply(null));
    await expect(new SupabaseStore(db).commit(MATCH, 0, write)).rejects.toThrow("save the match");
  });
});
