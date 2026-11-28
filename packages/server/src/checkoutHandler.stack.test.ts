// The checkout Edge Function served by the local Supabase stack: no or a bad sign-in gives 401, a player who owns the
// full game gives 409, and with the Paddle secrets unset (as on the CI stack) a player without it gives 503, with no
// secret in the body. It needs no Paddle account: with the secrets unset the function never calls Paddle. Without a
// running stack and `supabase functions serve` for the function, one test says so and how to start them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, it } from "vitest";
import { client, type StackKeys } from "./migrations/localStack.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { accessToken, cleanUp, makeUser, onLocalStack } from "./test/stack.ts";
import type { TestUser } from "./test/stack.ts";

await onLocalStack(
  "the checkout Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    let service: SupabaseClient | undefined;
    const users: TestUser[] = [];
    const db = (): SupabaseClient => {
      if (!service) throw new Error("the checkout stack test setup has not run yet");
      return service;
    };
    const call = async (token: string | null) => callFunction(keys, "checkout", { method: "POST", token, body: {} });
    const refusal = (status: number, code: string) => ({
      status,
      json: { ok: false, error: { code, message: expect.any(String) } },
    });

    beforeAll(async () => {
      service = client(keys.url, keys.serviceKey);
      for (const name of ["owner", "buyer"]) users.push(await makeUser(keys, service, name));
      // The owner already has the full game on the web.
      const granted = await service
        .from("entitlement")
        .insert({ player: users[0]!.id, platform: "web", source: "test", created_at: 0 });
      if (granted.error) throw new Error(`granting the test owner an entitlement failed: ${granted.error.code}`);
    }, 60_000);

    afterAll(async () => {
      if (!service) return;
      const ids = users.map((u) => u.id);
      // Neither table links to auth.users, so removing the users would leave these rows behind.
      if (ids.length > 0) {
        await service.from("entitlement").delete().in("player", ids);
        await service.from("checkout_attempt").delete().in("player", ids);
      }
      await cleanUp(service, [], users);
    }, 60_000);

    it("a call with no sign-in, or with a bad token, gets 401; the anon key gets the handler's notSignedIn", async () => {
      // With no token or a malformed one, Supabase's gateway answers with its own 401 body before the function runs.
      expect((await call(null)).status).toBe(401);
      expect((await call("not-a-real-token")).status).toBe(401);
      // The anon key is a valid token, so it reaches the handler.
      expect(await call(keys.anonKey)).toEqual(refusal(401, "notSignedIn"));
    }, 60_000);

    it("a player who already owns the full game gets 409 alreadyOwned", async () => {
      expect(await call(await accessToken(users[0]!))).toEqual(refusal(409, "alreadyOwned"));
    }, 60_000);

    it("with the Paddle secrets unset, a signed-in player without the game gets 503 checkoutUnavailable and no secret", async () => {
      const reply = await call(await accessToken(users[1]!));
      expect(reply).toEqual(refusal(503, "checkoutUnavailable"));
      const body = JSON.stringify(reply.json);
      for (const secret of ["PADDLE", "paddle.com", "pdl_", keys.serviceKey]) expect(body).not.toContain(secret);
      expect(body).not.toContain("url");
      // The refused call was counted, but nothing else was written for the player.
      const owned = await db().from("entitlement").select("platform").eq("player", users[1]!.id);
      expect(owned).toMatchObject({ error: null, data: [] });
      const counted = await db().from("checkout_attempt").select("player").eq("player", users[1]!.id);
      expect(counted.error).toBeNull();
      expect(counted.data?.length).toBeGreaterThan(0);
    }, 60_000);
  },
  async (keys) => whyFunctionUnavailable(keys, "checkout"),
);
