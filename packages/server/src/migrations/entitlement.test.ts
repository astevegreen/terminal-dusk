// The entitlement migration (supabase/migrations/20261027000000_entitlement.sql) on the local Supabase stack.
// `pnpm test:migrations` applies every migration to an empty database first. These checks prove the table's
// columns and checks, that a signed-in user reads only their own rows, that a signed-out client reads nothing,
// and that no client may insert, update or delete a row: only the service role writes them.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { entitlementStack } from "../test/entitlementStack.ts";
import type { EntitlementInsert } from "../test/entitlementStack.ts";
import { onLocalStack } from "../test/stack.ts";
import { client, freshId } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";
const COLUMNS = ["id", "player", "platform", "source", "receipt_ref", "created_at"];

await onLocalStack("entitlement migration on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const row = (change: Partial<EntitlementInsert> = {}): EntitlementInsert => ({
    player: stack.owner.id,
    platform: "web",
    source: `test-${freshId()}`,
    receipt_ref: null,
    created_at: NOW,
    ...change,
  });
  const insert = async (value: EntitlementInsert) => (await stack.service.from("entitlement").insert(value)).error;
  const readBySource = async (source: string) =>
    (await stack.service.from("entitlement").select("*").eq("source", source)).data;

  it("has exactly the agreed columns, gives each row an id, and keeps a whole-number millisecond time", async () => {
    const value = row({ platform: "steam", receipt_ref: "test-receipt" });
    expect(await insert(value)).toBeNull();
    const read = await readBySource(value.source!);
    expect(read).toHaveLength(1);
    expect(Object.keys(read![0]!).toSorted()).toEqual(COLUMNS.toSorted());
    expect(read![0]).toEqual({ ...value, id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });

  it("accepts each of the four platforms, with or without a receipt reference", async () => {
    for (const platform of ["web", "steam", "ios", "android"]) {
      expect(await insert(row({ platform }))).toBeNull();
      expect(await insert(row({ platform, receipt_ref: "test-receipt" }))).toBeNull();
    }
  });

  it.each([
    ["an unknown platform", { platform: "switch" }, CHECK_VIOLATION],
    ["a platform in capitals", { platform: "WEB" }, CHECK_VIOLATION],
    ["an empty source", { source: "" }, CHECK_VIOLATION],
    ["a null platform", { platform: null }, NOT_NULL_VIOLATION],
    ["a null source", { source: null }, NOT_NULL_VIOLATION],
  ] as const)("rejects a row with %s", async (_name, change, code) => {
    const value = row(change);
    expect((await insert(value))?.code).toBe(code);
    if (value.source) expect(await readBySource(value.source)).toEqual([]);
  });

  it("a signed-in user reads their own rows and none of another user's", async () => {
    const mine = row();
    const theirs = row({ player: stack.other.id });
    expect(await insert(mine)).toBeNull();
    expect(await insert(theirs)).toBeNull();

    const read = await stack.owner.db.from("entitlement").select("*").in("source", [mine.source, theirs.source]);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([{ ...mine, id: expect.any(String) }]);
    const all = await stack.owner.db.from("entitlement").select("player");
    expect(all.data!.every((r) => r.player === stack.owner.id)).toBe(true);
  });

  it("a signed-out client reads nothing", async () => {
    const value = row();
    expect(await insert(value)).toBeNull();
    const read = await client(keys.url, keys.anonKey).from("entitlement").select("*");
    expect(read.data).toBeNull();
    expect(read.error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither insert, update nor delete entitlement rows, and a re-read shows nothing changed",
    async (who) => {
      const value = row();
      expect(await insert(value)).toBeNull();
      const before = await readBySource(value.source!);
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.owner.db;

      const inserted = await caller.from("entitlement").insert(row());
      const updated = await caller.from("entitlement").update({ platform: "steam" }).eq("source", value.source!);
      const deleted = await caller.from("entitlement").delete().eq("source", value.source!);
      expect([inserted, updated, deleted].map((answer) => answer.error?.code)).toEqual([
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
      ]);
      expect(await readBySource(value.source!)).toEqual(before);
    },
  );
});
