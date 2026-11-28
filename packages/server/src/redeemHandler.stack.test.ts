// The redeem Edge Function served by the local Supabase stack: no sign-in gives 401, a valid unused gift code grants
// the full game (the entitlement row exists afterwards), and the same code a second time, or an unknown code, is
// refused with the handler's status and code. Codes are made as tools/gift-codes.mjs makes them: the table keeps
// only the hash. Without a running stack and `supabase functions serve` for the function, one test says so.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, it } from "vitest";
import { giftCode, hashGiftCode, normalizeGiftCode } from "./giftCode.ts";
import { client, type StackKeys } from "./migrations/localStack.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { accessToken, cleanUp, makeUser, onLocalStack } from "./test/stack.ts";
import type { TestUser } from "./test/stack.ts";

await onLocalStack(
  "the redeem Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    let service: SupabaseClient | undefined;
    const users: TestUser[] = [];
    const hashes: string[] = [];
    const db = (): SupabaseClient => {
      if (!service) throw new Error("the redeem stack test setup has not run yet");
      return service;
    };
    const call = async (token: string | null, body: unknown) =>
      callFunction(keys, "redeem", { method: "POST", token, body });
    const refusal = (status: number, code: string) => ({
      status,
      json: { ok: false, error: { code, message: expect.any(String) } },
    });
    /** A new web gift code in the table, kept for clean-up; the code as a player would type it. */
    const newCode = async (): Promise<string> => {
      const code = giftCode();
      const hash = await hashGiftCode(normalizeGiftCode(code)!);
      hashes.push(hash);
      const made = await db().from("gift_code").insert({ code_hash: hash, platform: "web", created_at: 0 });
      if (made.error) throw new Error(`making the test gift code failed: ${made.error.code}`);
      return code;
    };

    beforeAll(async () => {
      service = client(keys.url, keys.serviceKey);
      for (const name of ["redeemer", "latecomer"]) users.push(await makeUser(keys, service, name));
    }, 60_000);

    afterAll(async () => {
      if (!service) return;
      const ids = users.map((u) => u.id);
      // None of these tables links to auth.users, so removing the users would leave their rows behind.
      if (ids.length > 0) {
        await service.from("entitlement").delete().in("player", ids);
        await service.from("gift_code_attempt").delete().in("player", ids);
      }
      if (hashes.length > 0) await service.from("gift_code").delete().in("code_hash", hashes);
      await cleanUp(service, [], users);
    }, 60_000);

    it("a call with no sign-in gets 401 notSignedIn", async () => {
      expect(await call(null, { code: "AAAAA-AAAAA-AAAAA-AAAAA" })).toEqual(refusal(401, "notSignedIn"));
    }, 60_000);

    it("a valid unused gift code grants the full game; the same code again, or an unknown code, is refused", async () => {
      const [first, second] = users as [TestUser, TestUser];
      const code = await newCode();

      const redeemed = await call(await accessToken(first), { code });
      expect(redeemed).toEqual({ status: 200, json: { ok: true, status: "redeemed", message: expect.any(String) } });
      const owned = await db().from("entitlement").select("platform").eq("player", first.id);
      expect(owned).toMatchObject({ error: null, data: [{ platform: "web" }] });

      // Someone else using the used code is refused and gets no copy.
      expect(await call(await accessToken(second), { code })).toEqual(refusal(409, "codeUsed"));
      const none = await db().from("entitlement").select("platform").eq("player", second.id);
      expect(none).toMatchObject({ error: null, data: [] });

      // A code that is in no table row (made fresh, never inserted) is unknown.
      expect(await call(await accessToken(second), { code: giftCode() })).toEqual(refusal(404, "unknownCode"));
    }, 60_000);
  },
  async (keys) => whyFunctionUnavailable(keys, "redeem"),
);
