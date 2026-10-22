import { describe, expect, it } from "vitest";
import { readMatch } from "./read.ts";
import { MemoryStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import { DAY, insertMatch, insertSaeLate, rulesetFor } from "./test/deadlines.ts";
import { bodyFor, NOW, SEED } from "./test/match.ts";

const deps = (store: MemoryStore) => ({ store, ruleset: (id: string) => rulesetFor(id) ?? undefined });

describe("sweepDeadlines: single matches", () => {
  it("no due match: returns nothing and changes nothing", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "lossOnTime", NOW);
    const before = store.stored("m1");
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY - 1)).toEqual([]);
    expect(store.stored("m1")).toEqual(before);
  });

  it("one extension: the record's clock changes, seq does not, and no event row is added", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW);
    const before = store.stored("m1")!;
    const eventsBefore = (await store.rows("m1"))!.events;
    const now = NOW + DAY + 30;
    expect(await sweepDeadlines(store, rulesetFor, now)).toEqual([{ matchId: "m1", status: "extended" }]);
    const after = store.stored("m1")!;
    expect(after.record.seq).toBe(before.record.seq);
    expect(after.record.clock?.deadlines).toEqual({ lio: now + DAY, sae: now + DAY });
    expect(after.record.clock?.graceUsed).toEqual({ lio: true, sae: true });
    expect(after.secret).toEqual(before.secret);
    expect(after.frames).toEqual(before.frames);
    expect((await store.rows("m1"))!.events).toEqual(eventsBefore);
  });

  it("after an extension, submit takes the late side's answer", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW);
    const now = NOW + DAY + 30;
    await sweepDeadlines(store, rulesetFor, now);
    const loaded = (await store.load("m1"))!;
    const body = bodyFor(0, loaded.secret, "lio");
    const result = await submit(deps(store), { matchId: "m1", player: "alice", body, now: now + 1 });
    expect(result).toMatchObject({ ok: true, value: { seq: 1 } });
  });

  it("one loss on time: the match row shows the loss on time and the published seed", async () => {
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "lossOnTime", NOW);
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY)).toEqual([{ matchId: "m1", status: "timedOut" }]);
    const read = (await readMatch(store, "m1", null, -1))!;
    expect(read.match.status).toEqual({ kind: "over", winner: "lio", reason: "timeout" });
    expect(read.match.seed).toBe(SEED);
    expect(read.match.seq).toBe(2);
    expect(store.stored("m1")?.record.seq).toBe(2);
  });

  it("after a loss on time, submit refuses further answers", async () => {
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "lossOnTime", NOW);
    const loaded = (await store.load("m1"))!;
    const body = bodyFor(1, loaded.secret, "sae");
    await sweepDeadlines(store, rulesetFor, NOW + DAY);
    const result = await submit(deps(store), { matchId: "m1", player: "bob", body, now: NOW + DAY + 1 });
    expect(result.ok).toBe(false);
    expect((await store.load("m1"))!.record.seq).toBe(2);
  });

  it("both sides late on a simultaneous pick: the match row shows a draw on time (O7d)", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "lossOnTime", NOW);
    const seqBefore = store.stored("m1")!.record.seq;
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY)).toEqual([{ matchId: "m1", status: "timedOut" }]);
    const read = (await readMatch(store, "m1", null, -1))!;
    expect(read.match.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(read.match.seed).toBe(SEED);
    expect(store.stored("m1")?.record.seq).toBe(seqBefore + 1);
    expect(store.stored("m1")?.record.clock?.deadlines).toEqual({ lio: null, sae: null });
  });

  it("one millisecond before both deadlines, the both-late match is not due and is left unchanged", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "lossOnTime", NOW);
    const before = store.stored("m1");
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY - 1)).toEqual([]);
    expect(store.stored("m1")).toEqual(before);
  });
});

describe("sweepDeadlines: batches", () => {
  /** Due at NOW + DAY - 1000 (extension), - 500 (loss on time) and 0 (both late, a draw); one more not due yet. */
  async function mixed(): Promise<MemoryStore> {
    const store = new MemoryStore();
    insertMatch(store, "a-both-late", "lossOnTime", NOW);
    await insertSaeLate(store, "b-times-out", "lossOnTime", NOW - 500);
    insertMatch(store, "c-extends", "graceThenLoss", NOW - 1000);
    insertMatch(store, "d-not-due", "lossOnTime", NOW + 5);
    return store;
  }

  it("a mixed batch is applied in deadline order, one result per due match", async () => {
    const store = await mixed();
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY)).toEqual([
      { matchId: "c-extends", status: "extended" },
      { matchId: "b-times-out", status: "timedOut" },
      { matchId: "a-both-late", status: "timedOut" },
    ]);
    expect(store.stored("a-both-late")?.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(store.stored("d-not-due")?.record.clock?.graceUsed).toEqual({ lio: false, sae: false });
  });

  it("running the sweep twice at the same now changes nothing the second time", async () => {
    const store = await mixed();
    const now = NOW + DAY;
    await sweepDeadlines(store, rulesetFor, now);
    const ids = ["a-both-late", "b-times-out", "c-extends", "d-not-due"];
    const snapshot = async () => Promise.all(ids.map(async (id) => [store.stored(id), await store.rows(id)]));
    const before = await snapshot();
    expect(await sweepDeadlines(store, rulesetFor, now)).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
});
