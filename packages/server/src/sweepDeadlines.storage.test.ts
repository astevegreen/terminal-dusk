import { describe, expect, it } from "vitest";
import type { DeadlineStore } from "./deadlineStore.ts";
import type { MatchStore } from "./store.ts";
import { MemoryStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import { DAY, insertMatch, insertSaeLate, rulesetFor } from "./test/deadlines.ts";
import { NOW } from "./test/match.ts";

type SweepStore = MatchStore & DeadlineStore;

/** Passes every call through to `inner`, with some calls replaced. */
const wrap = (inner: MemoryStore, change: Partial<SweepStore>): SweepStore => ({
  due: (now) => inner.due(now),
  load: (id) => inner.load(id),
  commit: (id, seq, write) => inner.commit(id, seq, write),
  saveClock: (id, seq, record) => inner.saveClock(id, seq, record),
  ...change,
});

/** A store where, right after each load, a player resigns the match, so its seq moves on before the save. */
function resignAfterLoad(inner: MemoryStore): SweepStore {
  const deps = { store: inner, ruleset: (id: string) => rulesetFor(id) ?? undefined };
  return wrap(inner, {
    async load(id) {
      const loaded = await inner.load(id);
      const resigned = await submit(deps, { matchId: id, player: "alice", body: { resign: true }, now: NOW + DAY });
      if (!resigned.ok) throw new Error(`the resignation was refused: ${resigned.error.code}`);
      return loaded;
    },
  });
}

describe("sweepDeadlines: conflicts", () => {
  it("a conflict: the match changes between due and commit, so the loss on time is not written", async () => {
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "lossOnTime", NOW);
    expect(await sweepDeadlines(resignAfterLoad(store), rulesetFor, NOW + DAY)).toEqual([
      { matchId: "m1", status: "conflict" },
    ]);
    expect(store.stored("m1")?.record.status).toEqual({ kind: "over", winner: "sae", reason: "resigned" });
  });

  it("a conflict on an extension: the clock is not written over the newer match", async () => {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW);
    expect(await sweepDeadlines(resignAfterLoad(store), rulesetFor, NOW + DAY)).toEqual([
      { matchId: "m1", status: "conflict" },
    ]);
    expect(store.stored("m1")?.record.clock?.graceUsed).toEqual({ lio: false, sae: false });
  });
});

describe("sweepDeadlines: one match's failure never stops the sweep, and the sweep never throws", () => {
  async function three(): Promise<MemoryStore> {
    const store = new MemoryStore();
    insertMatch(store, "m1", "graceThenLoss", NOW - 2);
    insertMatch(store, "m2", "graceThenLoss", NOW - 1);
    insertMatch(store, "m3", "graceThenLoss", NOW);
    return store;
  }
  const failure = () => Promise.reject(new Error("disk on fire"));

  it("a load that rejects gives storageFailed for that match only", async () => {
    const store = await three();
    const broken = wrap(store, { load: (id) => (id === "m2" ? failure() : store.load(id)) });
    expect(await sweepDeadlines(broken, rulesetFor, NOW + DAY)).toEqual([
      { matchId: "m1", status: "extended" },
      { matchId: "m2", status: "skipped", code: "storageFailed" },
      { matchId: "m3", status: "extended" },
    ]);
  });

  it("a commit, saveClock or load that throws gives storageFailed and the sweep carries on", async () => {
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "lossOnTime", NOW - 2);
    insertMatch(store, "m2", "graceThenLoss", NOW - 1);
    insertMatch(store, "m3", "graceThenLoss", NOW);
    const thrower = (): never => {
      throw new Error("disk on fire");
    };
    const broken = wrap(store, {
      commit: thrower,
      saveClock: (id, seq, record) => (id === "m2" ? thrower() : store.saveClock(id, seq, record)),
    });
    expect(await sweepDeadlines(broken, rulesetFor, NOW + DAY)).toEqual([
      { matchId: "m1", status: "skipped", code: "storageFailed" },
      { matchId: "m2", status: "skipped", code: "storageFailed" },
      { matchId: "m3", status: "extended" },
    ]);
    expect(store.stored("m1")?.record.status).toEqual({ kind: "active" });
  });

  it("notFound when load gives null, unknownRuleset when the lookup has no ruleset or throws", async () => {
    const store = await three();
    const missing = wrap(store, { load: (id) => (id === "m1" ? Promise.resolve(null) : store.load(id)) });
    const lookups = [
      () => null,
      (): never => {
        throw new Error("no rulesets");
      },
    ];
    for (const lookup of lookups) {
      const results = await sweepDeadlines(missing, lookup, NOW + DAY);
      expect(results).toEqual([
        { matchId: "m1", status: "skipped", code: "notFound" },
        { matchId: "m2", status: "skipped", code: "unknownRuleset" },
        { matchId: "m3", status: "skipped", code: "unknownRuleset" },
      ]);
    }
    expect(await sweepDeadlines(missing, rulesetFor, NOW + DAY)).toEqual([
      { matchId: "m1", status: "skipped", code: "notFound" },
      { matchId: "m2", status: "extended" },
      { matchId: "m3", status: "extended" },
    ]);
  });

  it("a due call that rejects gives no results and does not throw", async () => {
    const store = await three();
    const broken = wrap(store, { due: failure });
    expect(await sweepDeadlines(broken, rulesetFor, NOW + DAY)).toEqual([]);
  });
});
