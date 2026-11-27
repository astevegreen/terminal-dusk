// SupabaseGiftCodeStore against a stand-in client, so these run without the local stack. The stack tests
// (migrations/giftCode.test.ts) prove the SQL function itself.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { GiftCodeStorageError, SupabaseGiftCodeStore } from "./supabaseGiftCodeStore.ts";
import { shown, thrown } from "./test/errors.ts";

type Answer = { data: unknown; error: { code?: string; message?: string; details?: string } | null };
const PLAYER = "00000000-0000-4000-8000-000000000001";
const HASH = "a".repeat(64);
const FAKE_KEY = "service-key-that-must-not-leak";

/** A stand-in client whose rpc gives `answer` (or throws), keeping every call. */
function fakeClient(answer: Answer | "throws") {
  const calls: { name: string; args: unknown }[] = [];
  const db = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY} for ${HASH}`);
      return answer;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

describe("SupabaseGiftCodeStore.redeem", () => {
  it("makes one call to redeem_gift_code with the hash, the player and the time, and returns its outcome", async () => {
    const { db, calls } = fakeClient({ data: "redeemed", error: null });
    expect(await new SupabaseGiftCodeStore(db).redeem(HASH, PLAYER, 42)).toBe("redeemed");
    expect(calls).toEqual([{ name: "redeem_gift_code", args: { p_hash: HASH, p_player: PLAYER, p_now: 42 } }]);
  });

  it("passes every outcome the function gives straight through", async () => {
    for (const outcome of ["alreadyYours", "unknown", "used", "owned", "limited"]) {
      const { db } = fakeClient({ data: outcome, error: null });
      expect(await new SupabaseGiftCodeStore(db).redeem(HASH, PLAYER, 1)).toBe(outcome);
    }
  });

  it("a database error throws with its code only: no message, details, hash or player", async () => {
    const { db } = fakeClient({
      data: null,
      error: { code: "42501", message: `permission denied ${HASH}`, details: PLAYER },
    });
    const e = await thrown(() => new SupabaseGiftCodeStore(db).redeem(HASH, PLAYER, 1));
    expect(e).toBeInstanceOf(GiftCodeStorageError);
    expect(shown(e)).toContain("42501");
    for (const secret of [HASH, PLAYER, "permission denied"]) expect(shown(e)).not.toContain(secret);
  });

  it("a client that throws gives a storage error without the thrown text", async () => {
    const { db } = fakeClient("throws");
    const e = await thrown(() => new SupabaseGiftCodeStore(db).redeem(HASH, PLAYER, 1));
    expect(e).toBeInstanceOf(GiftCodeStorageError);
    for (const secret of [HASH, FAKE_KEY]) expect(shown(e)).not.toContain(secret);
  });

  it("an answer that is not an outcome throws, rather than being taken as one", async () => {
    for (const data of [null, "granted", 1, { status: "redeemed" }]) {
      const { db } = fakeClient({ data, error: null });
      expect(await thrown(() => new SupabaseGiftCodeStore(db).redeem(HASH, PLAYER, 1))).toBeInstanceOf(
        GiftCodeStorageError,
      );
    }
  });
});
