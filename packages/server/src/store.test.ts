import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store.ts";
import { created, MATCH } from "./test/match.ts";

const newMatch = () => {
  const start = created();
  return { record: start.record, secret: start.secret, frames: start.frames };
};

describe("MemoryStore: the in-memory storage port", () => {
  it("load gives null for a match that does not exist", async () => {
    expect(await new MemoryStore().load("nope")).toBeNull();
  });

  it("insert puts in a new match (seq 0) that load then returns as its record and secret", async () => {
    const store = new MemoryStore();
    const match = newMatch();
    store.insert(MATCH, match);
    expect(match.record.seq).toBe(0);
    expect(await store.load(MATCH)).toEqual({ record: match.record, secret: match.secret });
  });

  it("commit saves record, secret and frames together when the stored seq equals expectedSeq", async () => {
    const store = new MemoryStore();
    store.insert(MATCH, newMatch());
    const next = newMatch();
    next.record = { ...next.record, seq: 1, updatedAt: next.record.updatedAt + 1 };
    next.frames = { ...next.frames, spectator: { ...next.frames.spectator, seq: 1 } };
    expect(await store.commit(MATCH, 0, next)).toBe("saved");
    expect(store.stored(MATCH)).toEqual(next);
  });

  it("commit saves nothing and reports a conflict when the stored seq has moved on", async () => {
    const store = new MemoryStore();
    const first = newMatch();
    store.insert(MATCH, first);
    const next = { ...newMatch(), record: { ...first.record, seq: 1 } };
    expect(await store.commit(MATCH, 3, next)).toBe("conflict");
    expect(store.stored(MATCH)).toEqual(first);
  });

  it("commit reports a conflict, and saves nothing, for a match that does not exist", async () => {
    const store = new MemoryStore();
    expect(await store.commit(MATCH, 0, newMatch())).toBe("conflict");
    expect(store.stored(MATCH)).toBeNull();
  });

  it("keeps copies: changing an object after insert, commit or load does not change what is stored", async () => {
    const store = new MemoryStore();
    const inserted = newMatch();
    store.insert(MATCH, inserted);
    const before = store.stored(MATCH);
    inserted.record.seq = 99;
    inserted.secret.log.push({ system: "resign", side: "lio" });
    const loaded = await store.load(MATCH);
    loaded!.record.players.lio = "mallory";
    loaded!.secret.seed = "changed";
    expect(store.stored(MATCH)).toEqual(before);

    const committed = newMatch();
    expect(await store.commit(MATCH, 0, committed)).toBe("saved");
    committed.frames.lio.seq = 42;
    committed.record.status = { kind: "over" } as typeof committed.record.status;
    expect(store.stored(MATCH)).toEqual(newMatch());
  });
});
