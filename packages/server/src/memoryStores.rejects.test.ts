// O12, acceptance criterion 4: an in-memory store method runs its body inside the promise, so a failure in
// it reaches the caller as a rejected promise, never as a throw at the moment of the call.
import type { MatchRecord } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { Invite } from "./inviteStore.ts";
import { MemoryInviteStore } from "./inviteStore.ts";
import type { TurnAlert } from "./notifyStore.ts";
import { MemoryNotifyStore } from "./notifyStore.ts";
import { MemoryStore } from "./store.ts";
import { created, MATCH } from "./test/match.ts";

/** Calls `call` and gives back its promise, failing the test when the call itself throws. */
const called = <T>(call: () => Promise<T>): Promise<T> => {
  let result: Promise<T> | undefined;
  expect(() => {
    result = call();
  }).not.toThrow();
  return result!;
};

// JSON cannot serialise a bigint, so `copy` (JSON round trip) throws on it.
const unserialisable = 1n as unknown as number;

describe("a failure inside an in-memory store method rejects the promise instead of throwing", () => {
  it("MemoryStore.saveClock given a record copy cannot serialise rejects", async () => {
    const store = new MemoryStore();
    const start = created();
    store.insert(MATCH, { record: start.record, secret: start.secret, frames: start.frames });
    const bad: MatchRecord = { ...start.record, updatedAt: unserialisable };
    await expect(called(() => store.saveClock(MATCH, 0, bad))).rejects.toThrow(TypeError);
  });

  it("MemoryStore.commit given a write copy cannot serialise rejects", async () => {
    const store = new MemoryStore();
    const start = created();
    store.insert(MATCH, { record: start.record, secret: start.secret, frames: start.frames });
    const bad = { record: { ...start.record, updatedAt: unserialisable }, secret: start.secret, frames: start.frames };
    await expect(called(() => store.commit(MATCH, 0, bad))).rejects.toThrow(TypeError);
  });

  it("MemoryInviteStore.save given an invite copy cannot serialise rejects", async () => {
    const store = new MemoryInviteStore(new MemoryStore());
    const bad: Invite = { code: "ABCD2345", host: "host-hana", sides: { mode: "random" }, createdAt: unserialisable };
    await expect(called(() => store.save(bad))).rejects.toThrow(TypeError);
  });

  it("MemoryNotifyStore.markSent given no alert rejects", async () => {
    const store = new MemoryNotifyStore();
    const missing = null as unknown as TurnAlert;
    await expect(called(() => store.markSent(missing, 5))).rejects.toThrow(TypeError);
  });

  it("MemoryNotifyStore.queue given no list rejects", async () => {
    const store = new MemoryNotifyStore();
    const missing = null as unknown as TurnAlert[];
    await expect(called(() => store.queue(missing))).rejects.toThrow(TypeError);
  });
});
