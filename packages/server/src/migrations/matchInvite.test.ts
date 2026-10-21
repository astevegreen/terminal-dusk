// The match_invite migration (supabase/migrations/20261022000000_match_invite.sql) on the local Supabase stack.
// `pnpm test:migrations` applies every migration to an empty database first. These checks prove the table's
// columns and check constraints, that deleting a match removes its invite, that no client may read or write
// invites, and that only the service role may run accept_invite.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { rowsFor } from "../rows.ts";
import { expectedStart, inviteStack } from "../test/inviteStack.ts";
import { onLocalStack, putIn, storedRows, writeOf } from "../test/stack.ts";
import type { Stored } from "../test/stack.ts";
import { client } from "./localStack.ts";

const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const COLUMNS = ["code", "host_id", "mode", "host_side", "created_at", "joiner_id", "match_id"];

type Row = Record<string, unknown>;

await onLocalStack("match_invite migration on the local Supabase stack", (keys) => {
  const stack = inviteStack(keys);
  const unused = (change: Row = {}): Row => ({
    code: stack.code(),
    host_id: stack.host.id,
    mode: "random",
    host_side: null,
    created_at: NOW,
    joiner_id: null,
    match_id: null,
    ...change,
  });
  /** A match put in with the service role, for rows that name a match. */
  const storedMatch = async (): Promise<string> => {
    const matchId = stack.matchId();
    await putIn(stack.service, writeOf(expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW)));
    return matchId;
  };
  const readInvite = async (code: string) =>
    (await stack.service.from("match_invite").select("*").eq("code", code)).data;

  it("has exactly the agreed columns, and keeps a whole-number millisecond time", async () => {
    const row = unused();
    expect((await stack.service.from("match_invite").insert(row)).error).toBeNull();
    const read = await readInvite(row.code as string);
    expect(read).toHaveLength(1);
    expect(Object.keys(read![0]!).toSorted()).toEqual(COLUMNS.toSorted());
    expect(read![0]).toEqual(row);
  });

  it("accepts each valid side mode, unused and joined", async () => {
    const matchId = await storedMatch();
    for (const change of [
      { mode: "random" },
      { mode: "invitee" },
      { mode: "host", host_side: "lio" },
      { mode: "host", host_side: "sae", joiner_id: stack.joiner.id, match_id: matchId },
    ]) {
      expect((await stack.service.from("match_invite").insert(unused(change))).error).toBeNull();
    }
  });

  it.each([
    ["a mode that is not one of the three", { mode: "north" }],
    ["host chooses, without a host side", { mode: "host", host_side: null }],
    ["host chooses, with a side that is not lio or sae", { mode: "host", host_side: "north" }],
    ["random, with a host side", { mode: "random", host_side: "lio" }],
    ["invitee chooses, with a host side", { mode: "invitee", host_side: "sae" }],
    ["a joiner without a match", { joiner: true }],
    ["a match without a joiner", { match: true }],
    ["the host as the joiner", { joiner: true, match: true, self: true }],
  ])("rejects an invite with %s", async (_name, change: Row) => {
    const { joiner, match, self, ...columns } = change;
    const row = unused(columns);
    if (joiner) row.joiner_id = self ? stack.host.id : stack.joiner.id;
    if (match) row.match_id = await storedMatch();
    const { error } = await stack.service.from("match_invite").insert(row);
    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(await readInvite(row.code as string)).toEqual([]);
  });

  it("deleting a match removes its invite", async () => {
    const matchId = await storedMatch();
    const row = unused({ joiner_id: stack.joiner.id, match_id: matchId });
    expect((await stack.service.from("match_invite").insert(row)).error).toBeNull();
    expect((await stack.service.from("match").delete().eq("match_id", matchId)).error).toBeNull();
    expect(await readInvite(row.code as string)).toEqual([]);
  });

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s can neither read nor write match_invite, and a re-read with the service role shows nothing changed",
    async (who) => {
      const row = unused();
      const code = row.code as string;
      expect((await stack.service.from("match_invite").insert(row)).error).toBeNull();
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.joiner.db;

      const read = await caller.from("match_invite").select("*").eq("code", code);
      const inserted = await caller.from("match_invite").insert(unused());
      const updated = await caller.from("match_invite").update({ mode: "invitee" }).eq("code", code);
      const deleted = await caller.from("match_invite").delete().eq("code", code);
      expect(read.data).toBeNull();
      expect([read, inserted, updated, deleted].map((answer) => answer.error?.code)).toEqual([
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
      ]);
      expect(await readInvite(code)).toEqual([row]);
    },
  );

  it.each(["signed-out client", "signed-in user"] as const)(
    "a %s may not run accept_invite, and a re-read with the service role shows nothing changed",
    async (who) => {
      const row = unused();
      const code = row.code as string;
      expect((await stack.service.from("match_invite").insert(row)).error).toBeNull();
      const matchId = stack.matchId();
      const start = expectedStart(matchId, { lio: stack.host.id, sae: stack.joiner.id }, NOW);
      const rows = rowsFor(writeOf(start));
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : stack.joiner.db;

      const { data, error } = await caller.rpc("accept_invite", {
        p_code: code,
        p_joiner: stack.joiner.id,
        p_match: rows.match,
        p_secret: start.secret,
        p_views: rows.views,
        p_events: rows.events,
      });

      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(await readInvite(code)).toEqual([row]);
      const nothing: Stored = { match: [], secret: [], views: [], events: [] };
      expect(await storedRows(stack.service, matchId)).toEqual(nothing);
    },
  );
});
