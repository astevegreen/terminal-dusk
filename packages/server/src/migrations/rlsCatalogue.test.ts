// Row-level security across the whole table catalogue, on the local Supabase stack. Each table's own migration
// test checks its policies in detail; this one makes sure no table is left out. It lists every table the database
// exposes and fails when one is missing from CATALOGUE below, so a new table must say here who may read its rows.
// Then, for every table, a player of the test match, a signed-in stranger and a signed-out client:
// - read only the rows CATALOGUE says they may read: the player their own side's rows and their own entitlement,
//   the stranger and the signed-out client only the rows anyone may read;
// - are refused any insert, update or delete outright (only the server writes, with the service role).
// Without a running local stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, it } from "vitest";
import { cleanUp, makeUser, newGame, onLocalStack, putIn, writeOf } from "../test/stack.ts";
import type { TestUser } from "../test/stack.ts";
import { rowsFor } from "../rows.ts";
import { client, freshId, type StackKeys } from "./localStack.ts";

type Row = Record<string, unknown>;
type Who = "player" | "stranger" | "signedOut";

const NOW = 1_700_000_000_000;
const PERMISSION_DENIED = "42501";
const WHO: Who[] = ["player", "stranger", "signedOut"];

// The server package has no DOM types, so the runtime's fetch is typed here for the one call below.
type Reply = { ok: boolean; status: number; json(): Promise<unknown> };
const fetchFn = (
  globalThis as unknown as {
    fetch: (url: string, init: { headers: Record<string, string> }) => Promise<Reply>;
  }
).fetch;

/** What the tests seed: a full match between two players, a spare bare match, an invite, an alert, an entitlement. */
type Seeded = { matchId: string; spareId: string; code: string; player: string };

/** One table: how to find the test's rows, which of them anyone may read, and a valid new row and change to try. */
type Entry = {
  /** The column and value that pick out this test's rows. */
  scope: (s: Seeded) => [string, string];
  /** Whether a stranger or a signed-out client may read this row. */
  public: (row: Row) => boolean;
  /** Whether the test match's LIO player may read this row (the seeded entitlement is theirs). */
  player: (row: Row) => boolean;
  /** A new row the table would accept, made from a seeded one, for the insert attempt. */
  fresh: (row: Row, s: Seeded) => Row;
  /** A change to a seeded row, for the update attempt. */
  touch: (row: Row) => Row;
};

const byMatch = (s: Seeded): [string, string] => ["match_id", s.matchId];
const nobody = () => false;
const spectator = (row: Row) => row.viewer === "spectator";
const ownSide = (row: Row) => row.viewer === "spectator" || row.viewer === "lio";

/** Every table the database exposes. A new table goes here, with who may read it; nobody but the server writes. */
const CATALOGUE: Record<string, Entry> = {
  match: {
    scope: byMatch,
    public: () => true,
    player: () => true,
    fresh: (row) => ({ ...row, match_id: `test-${freshId()}` }),
    touch: (row) => ({ updated_at: Number(row.updated_at) + 1 }),
  },
  match_secret: {
    scope: byMatch,
    public: nobody,
    player: nobody,
    fresh: (row, s) => ({ ...row, match_id: s.spareId }),
    touch: () => ({ secret: { touched: true } }),
  },
  match_view: {
    scope: byMatch,
    public: spectator,
    player: ownSide,
    fresh: (row, s) => ({ ...row, match_id: s.spareId }),
    touch: (row) => ({ seq: Number(row.seq) + 1 }),
  },
  match_event: {
    scope: byMatch,
    public: spectator,
    player: ownSide,
    fresh: (row, s) => ({ ...row, match_id: s.spareId }),
    touch: () => ({ events: [] }),
  },
  match_invite: {
    scope: (s) => ["code", s.code],
    public: nobody,
    player: nobody,
    fresh: (row) => ({ ...row, code: freshId() }),
    touch: (row) => ({ created_at: Number(row.created_at) + 1 }),
  },
  notify_queue: {
    scope: byMatch,
    public: nobody,
    player: nobody,
    fresh: (row, s) => ({ ...row, match_id: s.spareId }),
    touch: () => ({ sent_at: NOW }),
  },
  entitlement: {
    scope: (s) => ["player", s.player],
    public: nobody,
    player: () => true,
    fresh: (row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== "id")),
    touch: () => ({ source: "touched" }),
  },
};
const TABLES = Object.keys(CATALOGUE).toSorted();

/** The table names in the stack's API description (PostgREST's OpenAPI root), read with the service key. */
async function exposedTables(keys: StackKeys): Promise<string[]> {
  const response = await fetchFn(`${keys.url}/rest/v1/`, {
    headers: { apikey: keys.serviceKey, Authorization: `Bearer ${keys.serviceKey}` },
  });
  if (!response.ok) throw new Error(`the API description did not load: HTTP ${response.status}`);
  const description = (await response.json()) as { definitions?: Record<string, unknown> };
  if (!description.definitions) throw new Error("the API description lists no tables");
  return Object.keys(description.definitions).toSorted();
}

await onLocalStack("row-level security across every table on the local Supabase stack", (keys) => {
  let service: SupabaseClient | undefined;
  let seeded: Seeded | undefined;
  const users: TestUser[] = [];
  const matchIds: string[] = [];
  const clients = {} as Record<Who, SupabaseClient>;

  const ready = <T>(value: T | undefined): T => {
    if (value === undefined) throw new Error("the row-level security test setup has not run yet");
    return value;
  };
  const insert = async (table: string, row: Row | Row[]) => {
    const { error } = await ready(service)
      .from(table)
      .insert(row as never);
    if (error) throw new Error(`could not put in the ${table} test row: ${error.code}`);
  };
  /** This test's rows of a table, as `db` reads them, in a fixed order; a permission error reads as no rows. */
  const rowsOf = async (db: SupabaseClient, table: string): Promise<Row[]> => {
    const [column, value] = CATALOGUE[table]!.scope(ready(seeded));
    const { data, error } = await db.from(table).select("*").eq(column, value);
    if (error?.code === PERMISSION_DENIED) return [];
    if (error) throw new Error(`reading ${table} failed with ${error.code}`);
    return (data as Row[])
      .map((row) => JSON.stringify(row))
      .toSorted()
      .map((text) => JSON.parse(text) as Row);
  };

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    // Each id is kept for clean-up as soon as it exists, so a setup that fails part-way leaves nothing behind.
    for (const name of ["rls-lio", "rls-sae", "rls-stranger"]) users.push(await makeUser(keys, service, name));
    const [lio, sae, stranger] = users;
    clients.player = lio!.db;
    clients.stranger = stranger!.db;
    clients.signedOut = client(keys.url, keys.anonKey);

    const game = newGame({ lio: lio!.id, sae: sae!.id });
    const spare = newGame({ lio: lio!.id, sae: sae!.id });
    seeded = { matchId: game.record.matchId, spareId: spare.record.matchId, code: freshId(), player: lio!.id };
    matchIds.push(seeded.matchId, seeded.spareId);
    await putIn(service, writeOf(game));
    await insert("match", rowsFor(writeOf(spare)).match);
    await insert("match_invite", {
      code: seeded.code,
      host_id: lio!.id,
      mode: "random",
      host_side: null,
      created_at: NOW,
    });
    await insert("notify_queue", { match_id: seeded.matchId, player: lio!.id, seq: 0, queued_at: NOW, waiting_seq: 0 });
    await insert("entitlement", { player: lio!.id, platform: "web", source: "rls-test", created_at: NOW });
  }, 60_000);

  afterAll(async () => {
    if (!service) return;
    if (seeded) {
      await service.from("match_invite").delete().eq("code", seeded.code);
      await service.from("entitlement").delete().eq("player", seeded.player);
    }
    await cleanUp(service, matchIds, users);
  }, 60_000);

  it("the database exposes exactly the tables in the catalogue, so a new table must say who may read it", async () => {
    expect(await exposedTables(keys)).toEqual(TABLES);
  });

  it("the setup put in at least one row in every table, so each check below has something to find", async () => {
    for (const table of TABLES) expect(await rowsOf(ready(service), table), table).not.toEqual([]);
  });

  it.each(TABLES)("%s: a stranger and a signed-out client read only the rows anyone may read", async (table) => {
    const all = await rowsOf(ready(service), table);
    const expected = all.filter(CATALOGUE[table]!.public);
    expect(await rowsOf(clients.stranger, table)).toEqual(expected);
    expect(await rowsOf(clients.signedOut, table)).toEqual(expected);
  });

  it.each(TABLES)("%s: the LIO player reads only the rows CATALOGUE says they may read", async (table) => {
    const all = await rowsOf(ready(service), table);
    expect(await rowsOf(clients.player, table)).toEqual(all.filter(CATALOGUE[table]!.player));
  });

  it.each(TABLES)(
    "%s: a player, a stranger and a signed-out client are refused any insert, update or delete",
    async (table) => {
      const entry = CATALOGUE[table]!;
      const s = ready(seeded);
      const [column, value] = entry.scope(s);
      const before = await rowsOf(ready(service), table);
      const sample = before[0]!;
      for (const who of WHO) {
        const db = clients[who];
        const inserted = await db.from(table).insert(entry.fresh(sample, s) as never);
        expect(inserted.error?.code, `${who} inserting into ${table}`).toBe(PERMISSION_DENIED);
        // Refused outright, not just hidden by row-level security: every table revokes insert, update and delete
        // from clients, so an update or delete that merely changes zero rows means the grant was left in place.
        // On a table clients may read, a write grant left in place shows here as no error; on one they may not,
        // Postgres refuses the filter anyway, and the read checks above cover it.
        const updated = await db
          .from(table)
          .update(entry.touch(sample) as never)
          .eq(column, value);
        expect(updated.error?.code, `${who} updating ${table}`).toBe(PERMISSION_DENIED);
        const deleted = await db.from(table).delete().eq(column, value);
        expect(deleted.error?.code, `${who} deleting from ${table}`).toBe(PERMISSION_DENIED);
      }
      expect(await rowsOf(ready(service), table)).toEqual(before);
    },
  );
});
