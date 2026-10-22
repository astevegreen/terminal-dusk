import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store.ts";
import { submit } from "./submit.ts";
import { DAY, insertMatch, rulesetFor } from "./test/deadlines.ts";
import { created, NOW } from "./test/match.ts";

describe("DeadlineStore.due on MemoryStore", () => {
  it("gives no match when nothing is past its deadline", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "lossOnTime", NOW);
    expect(await store.due(NOW + DAY - 1)).toEqual([]);
  });

  it("gives active matches whose earliest deadline is at or before now, by deadline, then by match id", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m-c", "lossOnTime", NOW);
    insertMatch(store, "m-b", "lossOnTime", NOW);
    insertMatch(store, "m-z", "graceThenLoss", NOW - 5);
    insertMatch(store, "m-later", "lossOnTime", NOW + 1);
    expect(await store.due(NOW + DAY)).toEqual(["m-z", "m-b", "m-c"]);
  });

  it("leaves out a match with no clock and a match that is over", async () => {
    const store = new MemoryStore();
    const plain = created("no-clock");
    store.insert("no-clock", { record: plain.record, secret: plain.secret, frames: plain.frames });
    insertMatch(store, "over", "lossOnTime", NOW);
    const deps = { store, ruleset: (id: string) => rulesetFor(id) ?? undefined };
    const resigned = await submit(deps, { matchId: "over", player: "alice", body: { resign: true }, now: NOW + 1 });
    expect(resigned.ok).toBe(true);
    expect(await store.due(NOW + 10 * DAY)).toEqual([]);
  });
});

describe("DeadlineStore.saveClock on MemoryStore", () => {
  it("replaces only the record and the match row when the seq matches, and adds no event row", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW);
    const before = store.stored("m1")!;
    const rowsBefore = (await store.rows("m1"))!;
    const record = { ...before.record, updatedAt: NOW + 7 };
    expect(await store.saveClock("m1", 0, record)).toBe("saved");
    const after = store.stored("m1")!;
    expect(after).toEqual({ ...before, record });
    const rowsAfter = (await store.rows("m1"))!;
    expect(rowsAfter.events).toEqual(rowsBefore.events);
    expect(rowsAfter.views).toEqual(rowsBefore.views);
    expect(rowsAfter.match).toEqual({ ...rowsBefore.match, updated_at: NOW + 7 });
  });

  it("gives conflict and writes nothing when the stored seq has moved on, or the match is unknown", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW);
    const before = store.stored("m1")!;
    const record = { ...before.record, updatedAt: NOW + 7 };
    expect(await store.saveClock("m1", 1, record)).toBe("conflict");
    expect(await store.saveClock("nope", 0, record)).toBe("conflict");
    expect(store.stored("m1")).toEqual(before);
  });
});
