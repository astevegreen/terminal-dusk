// SupabaseInviteStore against a stand-in client, so these run without the local stack. The stack tests
// (supabaseInviteStore.*.stack.test.ts) prove the same behaviour against the real table and SQL function.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostCreate } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { Invite, InviteStore, SideMode } from "./inviteStore.ts";
import { rowsFor } from "./rows.ts";
import type { MatchWrite } from "./store.ts";
import { inviteRowFor, SupabaseInviteStore } from "./supabaseInviteStore.ts";
import type { InviteRow } from "./supabaseInviteStore.ts";
import { shown, thrown } from "./test/errors.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";
import { leaksIn } from "./test/leaks.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const FAKE_KEY = "service-key-that-must-not-leak";
const CODE = "ABCD2345";
const SEED = "invite-seed-that-must-not-leak";

/** A stand-in client: every insert, read and rpc gives `answer` (or throws), and every call is kept. */
function fakeClient(answer: Answer | "throws") {
  const calls: { call: string; args: unknown }[] = [];
  const reply = async () => {
    if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY} for ${CODE}`);
    return answer;
  };
  const query = {
    select: (columns: string) => (calls.push({ call: "select", args: columns }), query),
    eq: (column: string, value: string) => (calls.push({ call: "eq", args: [column, value] }), query),
    maybeSingle: reply,
  };
  const db = {
    from: (table: string) => ({
      ...query,
      insert: (row: unknown) => (calls.push({ call: `insert ${table}`, args: row }), reply()),
      select: (columns: string) => (calls.push({ call: `select ${table}`, args: columns }), query),
    }),
    rpc: (fn: string, args: unknown) => (calls.push({ call: `rpc ${fn}`, args }), reply()),
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const MODES: SideMode[] = [{ mode: "random" }, { mode: "host", hostSide: "sae" }, { mode: "invitee" }];
const invite = (sides: SideMode = { mode: "random" }): Invite => ({ code: CODE, host: HOST, sides, createdAt: 5 });
const made = hostCreate(firstDeckRuleset, { ...firstDeckConfig(), matchId: "match-9" }, SEED, INVITE_NOW);
if (!made.ok) throw new Error(made.error.code);
const write: MatchWrite = { record: made.value.record, secret: made.value.secret, frames: made.value.frames };
// A database error that quotes the secret, the seed, the code and the key, as a "failing row" detail can.
const quoting: Answer = {
  data: null,
  error: { code: "22P02", message: `bad row ${JSON.stringify(write.secret)} ${CODE}`, details: FAKE_KEY },
};

describe("SupabaseInviteStore.save", () => {
  it.each(MODES)("inserts the unused invite as one row (%o)", async (sides) => {
    const { db, calls } = fakeClient({ data: null, error: null });
    expect(await new SupabaseInviteStore(db).save(invite(sides))).toBe("saved");
    const row: InviteRow = {
      code: CODE,
      host_id: HOST,
      mode: sides.mode,
      host_side: sides.mode === "host" ? sides.hostSide : null,
      created_at: 5,
      joiner_id: null,
      match_id: null,
    };
    expect(calls).toEqual([{ call: "insert match_invite", args: row }]);
  });

  it("reports a clash when the code is taken (a unique violation)", async () => {
    const store = new SupabaseInviteStore(fakeClient({ data: null, error: { code: "23505" } }).db);
    expect(await store.save(invite())).toBe("clash");
  });
});

describe("SupabaseInviteStore.find", () => {
  it.each(MODES)("gives the unused invite a row stands for (%o)", async (sides) => {
    const { db, calls } = fakeClient({ data: inviteRowFor(invite(sides)), error: null });
    expect(await new SupabaseInviteStore(db).find(CODE)).toEqual({ ...invite(sides), accepted: null });
    expect(calls).toContainEqual({ call: "eq", args: ["code", CODE] });
  });

  it("gives who joined and the match once the invite is used", async () => {
    const row = { ...inviteRowFor(invite()), joiner_id: JOINER, match_id: "match-9" };
    const store = new SupabaseInviteStore(fakeClient({ data: row, error: null }).db);
    expect((await store.find(CODE))!.accepted).toEqual({ joiner: JOINER, matchId: "match-9" });
  });

  it("gives null for an unknown code", async () => {
    expect(await new SupabaseInviteStore(fakeClient({ data: null, error: null }).db).find(CODE)).toBeNull();
  });

  it.each([
    ["an unknown mode", { mode: "north", host_side: null }],
    ["host mode without a side", { mode: "host", host_side: null }],
    ["random mode with a side", { mode: "random", host_side: "lio" }],
  ])("throws on a row with %s", async (_name, change) => {
    const row = { ...inviteRowFor(invite()), ...change };
    const store = new SupabaseInviteStore(fakeClient({ data: row, error: null }).db);
    await expect(store.find(CODE)).rejects.toThrow(/malformed/);
  });
});

describe("SupabaseInviteStore.accept", () => {
  it("sends O2's rows, the secret and the joiner to accept_invite", async () => {
    const { db, calls } = fakeClient({ data: "accepted", error: null });
    expect(await new SupabaseInviteStore(db).accept(CODE, JOINER, write)).toBe("accepted");
    const rows = rowsFor(write);
    expect(calls).toEqual([
      {
        call: "rpc accept_invite",
        args: {
          p_code: CODE,
          p_joiner: JOINER,
          p_match: rows.match,
          p_secret: write.secret,
          p_views: rows.views,
          p_events: rows.events,
        },
      },
    ]);
  });

  it("gives unavailable when the SQL function reports it", async () => {
    const store = new SupabaseInviteStore(fakeClient({ data: "unavailable", error: null }).db);
    expect(await store.accept(CODE, JOINER, write)).toBe("unavailable");
  });

  it("rejects an answer that is neither accepted nor unavailable", async () => {
    const store = new SupabaseInviteStore(fakeClient({ data: "maybe", error: null }).db);
    await expect(store.accept(CODE, JOINER, write)).rejects.toThrow(/unexpected answer/);
  });
});

describe("SupabaseInviteStore: a database error throws, shows no code, secret, seed or key, and O5a answers storageFailed", () => {
  const steps = {
    save: (store: InviteStore) => store.save(invite()),
    find: (store: InviteStore) => store.find(CODE),
    accept: (store: InviteStore) => store.accept(CODE, JOINER, write),
  };
  const cases = (["save", "find", "accept"] as const).flatMap((step) =>
    (["a database error", "a client that throws"] as const).map((name) => [step, name] as const),
  );

  it.each(cases)("%s with %s", async (step, name) => {
    const store = new SupabaseInviteStore(fakeClient(name === "a database error" ? quoting : "throws").db);
    const error = await thrown(() => steps[step](store));
    expect(error).toBeInstanceOf(Error);
    const text = shown(error);
    expect(leaksIn(text, write.secret)).toEqual([]);
    for (const hidden of [FAKE_KEY, CODE, SEED]) expect(text).not.toContain(hidden);
  });

  it.each(["a database error", "a client that throws"] as const)(
    "createInvite, previewInvite and joinInvite answer storageFailed with %s",
    async (name) => {
      const failing = new SupabaseInviteStore(fakeClient(name === "a database error" ? quoting : "throws").db);
      const { deps, invites } = inviteWorld();
      const broken = { ...deps, invites: failing };
      const failed = { ok: false, error: { code: "storageFailed" } };
      expect(await createInvite(broken, { host: HOST, sides: { mode: "random" }, now: INVITE_NOW })).toMatchObject(
        failed,
      );
      expect(await previewInvite(broken, CODE)).toMatchObject(failed);
      expect(await joinInvite(broken, { code: CODE, player: JOINER, now: INVITE_NOW })).toMatchObject(failed);

      // accept alone failing: the invite is found, then accept throws.
      await invites.save(invite());
      const acceptFails: InviteStore = {
        save: (i) => invites.save(i),
        find: (c) => invites.find(c),
        accept: (...a) => failing.accept(...a),
      };
      const joined = await joinInvite(
        { ...deps, invites: acceptFails },
        { code: CODE, player: JOINER, now: INVITE_NOW },
      );
      expect(joined).toMatchObject(failed);
      expect(JSON.stringify(joined)).not.toContain(FAKE_KEY);
    },
  );
});
