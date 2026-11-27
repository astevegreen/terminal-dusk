// The in-memory gift code store: the same outcomes the redeem_gift_code SQL function gives on the local stack
// (src/migrations/giftCode.test.ts checks the SQL function on the stack).
import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { GIFT_CODE_SOURCE, MemoryGiftCodeStore, WRONG_GUESS_LIMIT, WRONG_GUESS_WINDOW_MS } from "./giftCodeStore.ts";

const NOW = 1_700_000_000_000;
const WEB = "a".repeat(64);
const STEAM = "b".repeat(64);
const UNKNOWN = "c".repeat(64);

function world() {
  const entitlements = new MemoryEntitlementStore();
  const store = new MemoryGiftCodeStore(entitlements, [
    { hash: WEB, platform: "web" },
    { hash: STEAM, platform: "steam" },
  ]);
  return { entitlements, store };
}

describe("MemoryGiftCodeStore.redeem", () => {
  it("a good code adds one entitlement with source 'gift code' for the code's platform", async () => {
    const { entitlements, store } = world();
    expect(await store.redeem(WEB, "alice", NOW)).toBe("redeemed");
    expect(await entitlements.forPlayer("alice")).toEqual([{ platform: "web", source: GIFT_CODE_SOURCE }]);
    expect(GIFT_CODE_SOURCE).toBe("gift code");
  });

  it("grants only the code's own platform: a steam code never grants web", async () => {
    const { entitlements, store } = world();
    expect(await store.redeem(STEAM, "alice", NOW)).toBe("redeemed");
    expect(await entitlements.forPlayer("alice")).toEqual([{ platform: "steam", source: GIFT_CODE_SOURCE }]);
  });

  it("the same code twice by its redeemer grants once and says it is already theirs", async () => {
    const { entitlements, store } = world();
    await store.redeem(WEB, "alice", NOW);
    expect(await store.redeem(WEB, "alice", NOW + 1)).toBe("alreadyYours");
    expect(await entitlements.forPlayer("alice")).toHaveLength(1);
  });

  it("a code someone else used is refused and grants nothing", async () => {
    const { entitlements, store } = world();
    await store.redeem(WEB, "alice", NOW);
    expect(await store.redeem(WEB, "bob", NOW + 1)).toBe("used");
    expect(await entitlements.forPlayer("bob")).toEqual([]);
  });

  it("two callers racing for one code: exactly one is granted", async () => {
    const { entitlements, store } = world();
    const outcomes = await Promise.all([store.redeem(WEB, "alice", NOW), store.redeem(WEB, "bob", NOW)]);
    expect(outcomes.toSorted()).toEqual(["redeemed", "used"]);
    const granted = [...(await entitlements.forPlayer("alice")), ...(await entitlements.forPlayer("bob"))];
    expect(granted).toHaveLength(1);
  });

  it("an unknown code is refused and grants nothing", async () => {
    const { entitlements, store } = world();
    expect(await store.redeem(UNKNOWN, "alice", NOW)).toBe("unknown");
    expect(await entitlements.forPlayer("alice")).toEqual([]);
  });

  it("a caller who already owns the platform is refused and the code stays unused for someone else", async () => {
    const { entitlements, store } = world();
    await entitlements.grant("alice", { platform: "web", source: "checkout" });
    expect(await store.redeem(WEB, "alice", NOW)).toBe("owned");
    expect(await entitlements.forPlayer("alice")).toEqual([{ platform: "web", source: "checkout" }]);
    expect(await store.redeem(WEB, "bob", NOW)).toBe("redeemed");
  });

  it("after too many wrong guesses in the hour a caller is refused without the code being looked at", async () => {
    const { entitlements, store } = world();
    for (let i = 0; i < WRONG_GUESS_LIMIT; i++) expect(await store.redeem(UNKNOWN, "alice", NOW + i)).toBe("unknown");
    // Even a good code is refused now, so guessing can't go on.
    expect(await store.redeem(WEB, "alice", NOW + WRONG_GUESS_LIMIT)).toBe("limited");
    expect(await entitlements.forPlayer("alice")).toEqual([]);
    // Another caller is not slowed.
    expect(await store.redeem(WEB, "bob", NOW)).toBe("redeemed");
  });

  it("counts a used code as a wrong guess, but not an owned platform or the caller's own code", async () => {
    const { entitlements, store } = world();
    await store.redeem(WEB, "alice", NOW);
    await entitlements.grant("bob", { platform: "steam", source: "steam" });
    for (let i = 0; i < WRONG_GUESS_LIMIT * 2; i++) {
      expect(await store.redeem(STEAM, "bob", NOW + i)).toBe("owned");
      expect(await store.redeem(WEB, "alice", NOW + i)).toBe("alreadyYours");
    }
    for (let i = 0; i < WRONG_GUESS_LIMIT; i++) expect(await store.redeem(WEB, "bob", NOW + i)).toBe("used");
    expect(await store.redeem(UNKNOWN, "bob", NOW + WRONG_GUESS_LIMIT)).toBe("limited");
  });

  it("wrong guesses older than the hour no longer count", async () => {
    const { store } = world();
    for (let i = 0; i < WRONG_GUESS_LIMIT; i++) await store.redeem(UNKNOWN, "alice", NOW);
    expect(await store.redeem(WEB, "alice", NOW + WRONG_GUESS_WINDOW_MS - 1)).toBe("limited");
    expect(await store.redeem(WEB, "alice", NOW + WRONG_GUESS_WINDOW_MS)).toBe("redeemed");
    expect(WRONG_GUESS_WINDOW_MS).toBe(3_600_000);
    expect(WRONG_GUESS_LIMIT).toBe(10);
  });
});
