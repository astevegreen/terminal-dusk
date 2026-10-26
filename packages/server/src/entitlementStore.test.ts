import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";

const HANA = "player-hana";
const OLGA = "player-olga";

describe("MemoryEntitlementStore", () => {
  it("gives a player with no rows an empty list", async () => {
    expect(await new MemoryEntitlementStore().forPlayer(HANA)).toEqual([]);
  });

  it("is built from rows and returns only that player's, in the order given", async () => {
    const store = new MemoryEntitlementStore([
      { player: HANA, platform: "steam", source: "steam" },
      { player: OLGA, platform: "web", source: "checkout" },
      { player: HANA, platform: "web", source: "gift-code" },
    ]);
    expect(await store.forPlayer(HANA)).toEqual([
      { platform: "steam", source: "steam" },
      { platform: "web", source: "gift-code" },
    ]);
    expect(await store.forPlayer(OLGA)).toEqual([{ platform: "web", source: "checkout" }]);
  });

  it("grant adds an entitlement after the player's earlier ones", async () => {
    const store = new MemoryEntitlementStore([{ player: HANA, platform: "ios", source: "app-store" }]);
    await store.grant(HANA, { platform: "android", source: "google-play" });
    await store.grant(OLGA, { platform: "web", source: "checkout" });
    expect(await store.forPlayer(HANA)).toEqual([
      { platform: "ios", source: "app-store" },
      { platform: "android", source: "google-play" },
    ]);
  });

  it("revokeAll removes every entitlement of that player and no one else's", async () => {
    const store = new MemoryEntitlementStore([
      { player: HANA, platform: "web", source: "checkout" },
      { player: OLGA, platform: "steam", source: "steam" },
    ]);
    await store.grant(HANA, { platform: "steam", source: "steam" });
    await store.revokeAll(HANA);
    expect(await store.forPlayer(HANA)).toEqual([]);
    expect(await store.forPlayer(OLGA)).toEqual([{ platform: "steam", source: "steam" }]);
  });

  it("returns copies, so changing a result or a granted value does not change what is stored", async () => {
    const granted = { platform: "web" as const, source: "checkout" };
    const store = new MemoryEntitlementStore();
    await store.grant(HANA, granted);
    granted.source = "changed";
    const first = await store.forPlayer(HANA);
    first[0]!.source = "changed too";
    first.push({ platform: "steam", source: "steam" });
    expect(await store.forPlayer(HANA)).toEqual([{ platform: "web", source: "checkout" }]);
  });

  it("does not keep the rows it was built from by reference", async () => {
    const rows = [{ player: HANA, platform: "web" as const, source: "checkout" }];
    const store = new MemoryEntitlementStore(rows);
    rows[0]!.source = "changed";
    rows.push({ player: HANA, platform: "web", source: "added" });
    expect(await store.forPlayer(HANA)).toEqual([{ platform: "web", source: "checkout" }]);
  });
});
