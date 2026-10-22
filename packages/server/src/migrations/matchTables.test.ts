// The match tables migration (supabase/migrations/20261020000000_match_tables.sql) on the local Supabase stack.
// `pnpm test:migrations` runs `supabase db reset` (all migrations on an empty database), then these checks
// prove who may read and write each table. Test users and rows are made with the local service role, fresh each run, and removed after.
// Without a running local stack the checks can't run, so one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import CLOCK_MIGRATION from "../../supabase/migrations/20261023000000_match_clock.sql?raw";
import { HOW_TO_START, client, freshId, stackKeys, whyUnavailable, type StackKeys } from "./localStack.ts";

type Row = Record<string, unknown>;
type Table = "match" | "match_secret" | "match_view" | "match_event";
type Who = "lio" | "sae" | "other" | "signedOut";

const TABLES: Table[] = ["match", "match_secret", "match_view", "match_event"];
const COLUMNS: Record<Table, string[]> = {
  match: [
    "match_id",
    "lio_player",
    "sae_player",
    "ruleset",
    "seed_hash",
    "seed",
    "seq",
    "status",
    "created_at",
    "updated_at",
    "clock",
    "next_deadline",
  ],
  match_secret: ["match_id", "secret"],
  match_view: ["match_id", "viewer", "seq", "frame"],
  match_event: ["match_id", "seq", "viewer", "events"],
};
const ORDER: Record<Table, string[]> = {
  match: ["match_id"],
  match_secret: ["match_id"],
  match_view: ["match_id", "viewer"],
  match_event: ["match_id", "seq", "viewer"],
};
const VIEWERS = ["lio", "sae", "spectator"] as const;
const WHO: Who[] = ["lio", "sae", "other", "signedOut"];
// A realistic time in milliseconds (November 2023): far past what a 32-bit integer column can hold.
const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const DAY = 86_400_000;
// A deadline clock as the host writes it (packages/host/src/types.ts, MatchClock).
const CLOCK = {
  rule: "graceThenLoss",
  days: 1,
  deadlines: { lio: NOW + DAY, sae: null },
  graceUsed: { lio: false, sae: true },
};

// The index can't be listed through the client API (it reads only the public tables), so its migration's text is
// checked here; `pnpm test:migrations` applying every migration to an empty database proves the text runs.
describe("the clock migration (supabase/migrations/20261023000000_match_clock.sql)", () => {
  it("adds an index on match.next_deadline for the deadline sweep", () => {
    expect(CLOCK_MIGRATION).toMatch(/create index \w+ on public\.match \(next_deadline\b/);
  });

  it("does not grant clients any write on match", () => {
    expect(CLOCK_MIGRATION).not.toMatch(/\bgrant\b(?!\s+execute)/i);
    expect(CLOCK_MIGRATION).not.toMatch(/create policy/i);
  });
});

const keys = stackKeys();
const unavailable = await whyUnavailable(keys);

if (unavailable !== null || keys === null) {
  describe("match tables migration on the local Supabase stack", () => {
    it(`did not run, because ${unavailable} (the warning below says how to start it)`, () => {
      (globalThis as { console?: { warn(m: string): void } }).console?.warn(
        `Match tables migration checks did not run: ${unavailable}. ${HOW_TO_START}`,
      );
      expect(unavailable).not.toBeNull();
    });
  });
} else {
  defineChecks(keys);
}

function defineChecks(keys: StackKeys) {
  const service = client(keys.url, keys.serviceKey);
  const clients = {} as Record<Who, SupabaseClient>;
  const userIds = {} as Record<"lio" | "sae" | "other", string>;
  // Match one has the LIO user on lio and the SAE user on sae; match two swaps them, so a read rule must use the
  // match's own players, not the side a user played somewhere else.
  const one = `test-${freshId()}`;
  const two = `test-${freshId()}`;
  const neverInserted = `test-${freshId()}`;
  const before = {} as Record<Table, Row[]>;

  const readAll = async (db: SupabaseClient, table: Table) => {
    let query = db.from(table).select("*").in("match_id", [one, two, neverInserted]);
    for (const column of ORDER[table]) query = query.order(column);
    return query;
  };
  const players = (id: string) => (id === one ? [userIds.lio, userIds.sae] : [userIds.sae, userIds.lio]);
  const matchRow = (id: string): Row => {
    const [lio, sae] = players(id);
    return {
      match_id: id,
      lio_player: lio,
      sae_player: sae,
      ruleset: "test-ruleset",
      seed_hash: "test-hash",
      seed: null,
      seq: 1,
      status: { kind: "active" },
      created_at: NOW,
      updated_at: NOW + 1,
      // Match one has a clock; match two has none.
      clock: id === one ? CLOCK : null,
      next_deadline: id === one ? NOW + DAY : null,
    };
  };
  // The viewers whose frames and events this client may read in one match.
  const readable = (who: Who, id: string) => {
    const [lio, sae] = players(id);
    const own = who === "signedOut" || who === "other" ? null : userIds[who];
    return VIEWERS.filter((v) => v === "spectator" || (v === "lio" && lio === own) || (v === "sae" && sae === own));
  };

  beforeAll(async () => {
    for (const who of ["lio", "sae", "other"] as const) {
      const email = `${who}-${freshId()}@terminal-dusk.test`;
      const password = freshId();
      const made = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (made.error || !made.data.user)
        throw new Error(`could not create the ${who} test user: ${made.error?.message}`);
      userIds[who] = made.data.user.id;
      clients[who] = client(keys.url, keys.anonKey);
      const signedIn = await clients[who].auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error(`could not sign in the ${who} test user: ${signedIn.error.message}`);
    }
    clients.signedOut = client(keys.url, keys.anonKey);

    const rows: Record<Table, Row[]> = { match: [], match_secret: [], match_view: [], match_event: [] };
    for (const id of [one, two]) {
      rows.match.push(matchRow(id));
      rows.match_secret.push({ match_id: id, secret: { note: "server only" } });
      for (const viewer of VIEWERS) {
        rows.match_view.push({ match_id: id, viewer, seq: 1, frame: { viewer } });
        rows.match_event.push({ match_id: id, seq: 1, viewer, events: [{ viewer }] });
      }
    }
    for (const table of TABLES) {
      const { error } = await service.from(table).insert(rows[table]);
      if (error) throw new Error(`could not add the ${table} test rows: ${error.message}`);
      const read = await readAll(service, table);
      before[table] = read.data ?? [];
    }
  }, 60_000);

  afterAll(async () => {
    // Removing the match rows removes their secret, view and event rows with them.
    await service.from("match").delete().in("match_id", [one, two, neverInserted]);
    for (const id of Object.values(userIds)) await service.auth.admin.deleteUser(id);
  }, 60_000);

  describe("the migration applied to an empty database", () => {
    it.each(TABLES)("%s has exactly the agreed columns", (table) => {
      expect(before[table].length).toBeGreaterThan(0);
      for (const row of before[table]) expect(Object.keys(row).toSorted()).toEqual(COLUMNS[table].toSorted());
    });

    it("match keeps whole-number millisecond times, too big for a 32-bit column", () => {
      expect(before.match.map((r) => [r.created_at, r.updated_at])).toEqual([
        [NOW, NOW + 1],
        [NOW, NOW + 1],
      ]);
    });

    it("match keeps the clock as written and the next deadline as a whole-number millisecond time, or null for both", () => {
      const byId = new Map(before.match.map((r) => [r.match_id, r]));
      expect(byId.get(one)).toMatchObject({ clock: CLOCK, next_deadline: NOW + DAY });
      expect(byId.get(two)).toMatchObject({ clock: null, next_deadline: null });
    });

    it.each(["match_view", "match_event"] as const)(
      "%s accepts only lio, sae or spectator as the viewer",
      async (table) => {
        const row: Row =
          table === "match_view"
            ? { match_id: one, viewer: "north", seq: 1, frame: {} }
            : { match_id: one, seq: 2, viewer: "north", events: [] };
        const { error } = await service.from(table).insert(row);
        expect(error?.code).toBe("23514");
      },
    );
  });

  describe.each(WHO)("read rules for the %s client", (who) => {
    it("reads every match row", async () => {
      const { data, error } = await readAll(clients[who], "match");
      expect(error).toBeNull();
      expect(data).toEqual(before.match);
    });

    it.each(["match_view", "match_event"] as const)(
      "reads exactly its own and the spectator rows of %s",
      async (table) => {
        const { data, error } = await readAll(clients[who], table);
        expect(error).toBeNull();
        const expected = before[table].filter((r) => readable(who, r.match_id as string).includes(r.viewer as never));
        expect(data).toEqual(expected);
      },
    );

    it("cannot read match_secret", async () => {
      const { data, error } = await readAll(clients[who], "match_secret");
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(data).toBeNull();
    });
  });

  describe.each(WHO)("write rules for the %s client", (who) => {
    // Built when the test runs, after beforeAll has made the users.
    const insertRow = (table: Table): Row =>
      ({
        match: { ...matchRow(one), match_id: neverInserted },
        match_secret: { match_id: two, secret: { note: "client" } },
        match_view: { match_id: two, viewer: "spectator", seq: 9, frame: {} },
        match_event: { match_id: two, seq: 9, viewer: "spectator", events: [] },
      })[table];
    const change: Record<Table, Row> = {
      match: { seq: 99 },
      match_secret: { secret: { note: "client" } },
      match_view: { frame: { changed: true } },
      match_event: { events: [] },
    };

    it.each(TABLES)("is refused every insert, update and delete on %s, and the rows stay unchanged", async (table) => {
      const inserted = await clients[who].from(table).insert(insertRow(table));
      const updated = await clients[who].from(table).update(change[table]).in("match_id", [one, two]);
      const deleted = await clients[who].from(table).delete().in("match_id", [one, two]);
      expect([inserted.error?.code, updated.error?.code, deleted.error?.code]).toEqual([
        PERMISSION_DENIED,
        PERMISSION_DENIED,
        PERMISSION_DENIED,
      ]);
      const after = await readAll(service, table);
      expect(after.data).toEqual(before[table]);
    });

    it("is refused an update of the clock and next_deadline columns, and the match rows stay unchanged", async () => {
      const updated = await clients[who]
        .from("match")
        .update({ clock: null, next_deadline: NOW + 2 * DAY })
        .in("match_id", [one, two]);
      expect(updated.error?.code).toBe(PERMISSION_DENIED);
      expect((await readAll(service, "match")).data).toEqual(before.match);
    });
  });
}
