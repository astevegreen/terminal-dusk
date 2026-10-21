import { hostCreate } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import type { Invite } from "./inviteStore.ts";
import { MemoryInviteStore } from "./inviteStore.ts";
import { MemoryStore } from "./store.ts";
import type { MatchWrite } from "./store.ts";

const invite = (): Invite => ({ code: "ABCD2345", host: "host-hana", sides: { mode: "random" }, createdAt: 5 });

const writeFor = (matchId: string): MatchWrite => {
  const made = hostCreate(firstDeckRuleset, { ...firstDeckConfig(), matchId }, "seed-x", 6);
  if (!made.ok) throw new Error(made.error.code);
  const { record, secret, frames } = made.value;
  return { record, secret, frames };
};

describe("MemoryInviteStore", () => {
  it("saves a new invite unused and finds a copy of it", async () => {
    const store = new MemoryInviteStore(new MemoryStore());
    expect(await store.save(invite())).toBe("saved");
    const found = await store.find("ABCD2345");
    expect(found).toEqual({ ...invite(), accepted: null });
    found!.host = "changed";
    expect((await store.find("ABCD2345"))!.host).toBe("host-hana");
    expect(await store.find("NOSUCHCD")).toBeNull();
  });

  it("never overwrites an existing code, used or not, and reports a clash", async () => {
    const store = new MemoryInviteStore(new MemoryStore());
    await store.save(invite());
    expect(await store.save({ ...invite(), host: "other-olga" })).toBe("clash");
    await store.accept("ABCD2345", "joiner-jo", writeFor("m1"));
    expect(await store.save({ ...invite(), host: "other-olga" })).toBe("clash");
    expect((await store.find("ABCD2345"))!.host).toBe("host-hana");
  });

  it("accept marks the invite used by the joiner with the match id and stores the match", async () => {
    const matches = new MemoryStore();
    const store = new MemoryInviteStore(matches);
    await store.save(invite());
    const write = writeFor("m1");
    expect(await store.accept("ABCD2345", "joiner-jo", write)).toBe("accepted");
    expect((await store.find("ABCD2345"))!.accepted).toEqual({ joiner: "joiner-jo", matchId: "m1" });
    expect(matches.stored("m1")).toEqual(write);
  });

  it("accept on a used or unknown invite stores nothing and reports it", async () => {
    const matches = new MemoryStore();
    const store = new MemoryInviteStore(matches);
    await store.save(invite());
    await store.accept("ABCD2345", "joiner-jo", writeFor("m1"));
    expect(await store.accept("ABCD2345", "third-tess", writeFor("m2"))).toBe("unavailable");
    expect(await store.accept("NOSUCHCD", "third-tess", writeFor("m3"))).toBe("unavailable");
    expect(matches.stored("m2")).toBeNull();
    expect(matches.stored("m3")).toBeNull();
    expect((await store.find("ABCD2345"))!.accepted).toEqual({ joiner: "joiner-jo", matchId: "m1" });
  });
});
