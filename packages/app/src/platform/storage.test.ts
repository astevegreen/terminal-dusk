import { describe, expect, it } from "vitest";
import { memoryStore, webStore } from "./storage.ts";
import type { StorageLike } from "./storage.ts";

/** A `Storage`-like object over a map, like localStorage in a working browser. */
function mapStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/** A `Storage`-like object that throws on every call, like blocked storage in private browsing. */
const blockedStorage: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("memoryStore", () => {
  it("reads back what was set, and null after remove or for a missing key", async () => {
    const store = memoryStore();
    expect(await store.get("k")).toBeNull();
    await store.set("k", "v");
    expect(await store.get("k")).toBe("v");
    await store.remove("k");
    expect(await store.get("k")).toBeNull();
  });
});

describe("webStore", () => {
  it("reads, writes and removes through the Storage it wraps", async () => {
    const storage = mapStorage();
    const store = webStore(storage);
    await store.set("k", "v");
    expect(storage.values.get("k")).toBe("v");
    expect(await store.get("k")).toBe("v");
    await store.remove("k");
    expect(storage.values.has("k")).toBe(false);
    expect(await store.get("k")).toBeNull();
  });

  it("turns a thrown getItem into null and a thrown setItem or removeItem into a quiet no-op", async () => {
    const store = webStore(blockedStorage);
    await expect(store.get("k")).resolves.toBeNull();
    await expect(store.set("k", "v")).resolves.toBeUndefined();
    await expect(store.remove("k")).resolves.toBeUndefined();
  });
});
