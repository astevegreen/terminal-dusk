import { describe, expect, it } from "vitest";
import { rowsFor } from "./rows.ts";
import { MemoryStore } from "./store.ts";
import type { MatchWrite } from "./store.ts";
import { submit } from "./submit.ts";
import { bodyFor, created, MATCH, NOW, setup } from "./test/match.ts";

const MATCH_FIELDS = [
  "created_at",
  "lio_player",
  "match_id",
  "ruleset",
  "sae_player",
  "seed",
  "seed_hash",
  "seq",
  "status",
  "updated_at",
];
const VIEW_FIELDS = ["frame", "match_id", "seq", "viewer"];
const EVENT_FIELDS = ["events", "match_id", "seq", "viewer"];
const keys = (row: object) => Object.keys(row).sort();

describe("rowsFor: one commit becomes one match row, three view rows and three event rows", () => {
  it("each row has exactly the listed fields, so a new field cannot slip into a readable row unnoticed", () => {
    const start = created();
    const rows = rowsFor(start);
    expect(keys(rows).sort()).toEqual(["events", "match", "views"]);
    expect(keys(rows.match)).toEqual(MATCH_FIELDS);
    expect(rows.views).toHaveLength(3);
    expect(rows.events).toHaveLength(3);
    for (const row of rows.views) expect(keys(row)).toEqual(VIEW_FIELDS);
    for (const row of rows.events) expect(keys(row)).toEqual(EVENT_FIELDS);
  });

  it("the match row copies the record into the SQL column names, with a null seed while the game is active", () => {
    const { record } = created();
    expect(rowsFor(created()).match).toEqual({
      match_id: MATCH,
      lio_player: "alice",
      sae_player: "bob",
      ruleset: record.ruleset,
      seed_hash: record.seedHash,
      seed: null,
      seq: 0,
      status: { kind: "active" },
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
  });

  it("there is one view row and one event row per viewer, each holding that viewer's frame and its events", () => {
    const start = created();
    const rows = rowsFor(start);
    expect(rows.views.map((r) => r.viewer)).toEqual(["lio", "sae", "spectator"]);
    expect(rows.events.map((r) => r.viewer)).toEqual(["lio", "sae", "spectator"]);
    for (const row of rows.views)
      expect(row).toEqual({ match_id: MATCH, viewer: row.viewer, seq: 0, frame: start.frames[row.viewer] });
    for (const row of rows.events) {
      expect(row).toEqual({ match_id: MATCH, seq: 0, viewer: row.viewer, events: start.frames[row.viewer].events });
    }
  });

  it("it never reads the secret: a commit whose secret cannot be touched still gives the same rows", () => {
    const start = created();
    const guarded = {
      record: start.record,
      frames: start.frames,
      get secret(): never {
        throw new Error("the secret was read");
      },
    };
    expect(rowsFor(guarded)).toEqual(rowsFor(start));
  });

  it("the rows share nothing with the record and frames they came from", () => {
    const start = created();
    const rows = rowsFor(start);
    rows.views[0]!.frame.seq = 99;
    rows.match.status = { kind: "over", winner: null, reason: "changed" };
    expect(start.frames.lio.seq).toBe(0);
    expect(start.record.status).toEqual({ kind: "active" });
  });
});

describe("MemoryStore: the readable rows each write keeps", () => {
  it("insert of a new match writes its seq 0 match, match_view and match_event rows the same way", async () => {
    const store = new MemoryStore();
    const start = created();
    store.insert(MATCH, { record: start.record, secret: start.secret, frames: start.frames });
    expect(await store.rows(MATCH)).toEqual(rowsFor(start));
  });

  it("each commit replaces the match row and the three view rows and adds three event rows", async () => {
    const { store, deps, start } = setup();
    const result = await submit(deps, {
      matchId: MATCH,
      player: "alice",
      body: bodyFor(0, start.secret, "lio"),
      now: NOW,
    });
    expect(result.ok).toBe(true);
    const after = rowsFor(store.stored(MATCH)!);
    expect(await store.rows(MATCH)).toEqual({
      match: after.match,
      views: after.views,
      events: [...rowsFor(start).events, ...after.events],
    });
    expect(after.match.seq).toBe(1);
  });

  it("a refused commit changes no row", async () => {
    const { store, deps, start } = setup();
    const before = await store.rows(MATCH);
    const next: MatchWrite = { ...created(), record: { ...start.record, seq: 1 } };
    expect(await store.commit(MATCH, 5, next)).toBe("conflict");
    expect(await store.rows(MATCH)).toEqual(before);
    const refused = await submit(deps, { matchId: MATCH, player: "mallory", body: { resign: true }, now: NOW });
    expect(refused.ok).toBe(false);
    expect(await store.rows(MATCH)).toEqual(before);
  });

  it("rows gives null for a match that does not exist, and copies that cannot change what is stored", async () => {
    const { store } = setup();
    expect(await store.rows("nope")).toBeNull();
    const rows = (await store.rows(MATCH))!;
    rows.match.lio_player = "mallory";
    rows.events.push(rows.events[0]!);
    const again = (await store.rows(MATCH))!;
    expect(again.match.lio_player).toBe("alice");
    expect(again.events).toHaveLength(3);
  });
});
