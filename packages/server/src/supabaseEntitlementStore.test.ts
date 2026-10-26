// SupabaseEntitlementStore against a stand-in client, so these run without the local stack. The stack test
// (supabaseEntitlementStore.stack.test.ts) proves the same behaviour against the real table.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { shown, thrown } from "./test/errors.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const PLAYER = "00000000-0000-4000-8000-000000000001";
const FAKE_KEY = "service-key-that-must-not-leak";
const RECEIPT = "receipt-ref-that-must-not-leak";
const SOURCE = "source-that-must-not-leak";

/** A stand-in client: the read gives `answer` (or throws), and every call is kept. */
function fakeClient(answer: Answer | "throws") {
  const calls: { call: string; args: unknown }[] = [];
  const query = {
    select: (columns: string) => (calls.push({ call: "select", args: columns }), query),
    eq: (column: string, value: string) => (calls.push({ call: "eq", args: [column, value] }), query),
    order: (column: string) => (calls.push({ call: "order", args: column }), query),
    then: (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) => {
      if (answer === "throws")
        return Promise.reject(new Error(`fetch failed with key ${FAKE_KEY}`)).then(resolve, reject);
      return Promise.resolve(answer).then(resolve, reject);
    },
  };
  const db = { from: (table: string) => (calls.push({ call: "from", args: table }), query) };
  return { db: db as unknown as SupabaseClient, calls };
}

describe("SupabaseEntitlementStore.forPlayer", () => {
  it("reads only platform and source of that player's rows, ordered by created_at then id", async () => {
    const { db, calls } = fakeClient({ data: [], error: null });
    expect(await new SupabaseEntitlementStore(db).forPlayer(PLAYER)).toEqual([]);
    expect(calls).toEqual([
      { call: "from", args: "entitlement" },
      { call: "select", args: "platform, source" },
      { call: "eq", args: ["player", PLAYER] },
      { call: "order", args: "created_at" },
      { call: "order", args: "id" },
    ]);
  });

  it("gives the rows as entitlements, in the order the database gave them", async () => {
    const rows = [
      { platform: "steam", source: "steam" },
      { platform: "web", source: "gift-code" },
    ];
    const store = new SupabaseEntitlementStore(fakeClient({ data: rows, error: null }).db);
    expect(await store.forPlayer(PLAYER)).toEqual(rows);
  });

  it("returns only platform and source, even when a row carries more", async () => {
    const rows = [{ platform: "ios", source: "app-store", receipt_ref: RECEIPT, id: "x" }];
    const store = new SupabaseEntitlementStore(fakeClient({ data: rows, error: null }).db);
    expect(await store.forPlayer(PLAYER)).toEqual([{ platform: "ios", source: "app-store" }]);
  });

  it.each([
    ["an unknown platform", { platform: "switch", source: SOURCE, receipt_ref: RECEIPT }],
    ["a null platform", { platform: null, source: SOURCE, receipt_ref: RECEIPT }],
    ["an empty source", { platform: "web", source: "", receipt_ref: RECEIPT }],
    ["a source that is not a string", { platform: "web", source: 7, receipt_ref: RECEIPT }],
  ])("throws a storage error showing no row data on a row with %s", async (_name, bad) => {
    const rows = [{ platform: "web", source: SOURCE }, bad];
    const error = await thrown(() =>
      new SupabaseEntitlementStore(fakeClient({ data: rows, error: null }).db).forPlayer(PLAYER),
    );
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(text).toMatch(/malformed/);
    for (const hidden of [RECEIPT, SOURCE, PLAYER, "switch"]) expect(text).not.toContain(hidden);
  });

  it("throws when the answer is not a list of rows", async () => {
    const store = new SupabaseEntitlementStore(fakeClient({ data: null, error: null }).db);
    await expect(store.forPlayer(PLAYER)).rejects.toThrow(/unexpected answer/);
  });

  it.each(["a database error", "a client that throws"] as const)(
    "throws a storage error with %s, showing no row data, receipt reference or key",
    async (name) => {
      const quoting: Answer = {
        data: null,
        error: { code: "XX000", message: `failing row (${PLAYER}, web, ${SOURCE}, ${RECEIPT})`, details: FAKE_KEY },
      };
      const db = fakeClient(name === "a database error" ? quoting : "throws").db;
      const error = await thrown(() => new SupabaseEntitlementStore(db).forPlayer(PLAYER));
      expect(error).toBeInstanceOf(Error);
      const text = shown(error);
      expect(text).toMatch(/Entitlement read failed/);
      for (const hidden of [RECEIPT, SOURCE, PLAYER, FAKE_KEY]) expect(text).not.toContain(hidden);
    },
  );
});
