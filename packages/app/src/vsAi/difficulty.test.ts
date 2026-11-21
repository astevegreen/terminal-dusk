import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import { TIER_KEY, loadTier, saveTier } from "./difficulty.tsx";

describe("keeping the AI's difficulty between visits (L11)", () => {
  it("is Medium when nothing is saved", async () => {
    expect(await loadTier(memoryStore())).toBe("medium");
  });
  it.each(["easy", "medium", "hard"] as const)("restores a saved %s", async (tier) => {
    const store = memoryStore();
    await saveTier(store, tier);
    expect(await store.get(TIER_KEY)).toBe(tier);
    expect(await loadTier(store)).toBe(tier);
  });
  it.each(["", "HARD", "impossible", "{}", "null"])("falls back to Medium for the bad value %j", async (bad) => {
    const store = memoryStore();
    await store.set(TIER_KEY, bad);
    expect(await loadTier(store)).toBe("medium");
  });
});
