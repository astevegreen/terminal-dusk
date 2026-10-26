// O9c on the local Supabase stack: the served invite Edge Function refuses a create from a user with no
// entitlement row (403 notEntitled), and accepts it once the service role adds a row for the stated platform.
// Without a running stack and `supabase functions serve` for the invite function, one test says so and how to
// start them.
import { expect, it } from "vitest";
import type { StackKeys } from "./migrations/localStack.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { accessToken, onLocalStack } from "./test/stack.ts";

await onLocalStack(
  "the invite Edge Function on the local Supabase stack: a free player cannot create a private game",
  (keys: StackKeys) => {
    const stack = inviteStack(keys);
    const call = async (token: string, body: unknown) => callFunction(keys, "invite", { method: "POST", token, body });

    it("a user with no entitlement row gets 403 notEntitled; once the service role adds one for the platform, create works", async () => {
      const token = await accessToken(stack.third);
      const create = { action: "create", sides: { mode: "random" }, platform: "ios" };

      const refused = await call(token, create);
      expect(refused).toEqual({
        status: 403,
        json: { ok: false, error: { code: "notEntitled", message: expect.any(String) } },
      });

      const granted = await stack.service
        .from("entitlement")
        .insert({ player: stack.third.id, platform: "ios", source: "test", created_at: 0 });
      expect(granted.error).toBeNull();

      const allowed = await call(token, create);
      expect(allowed).toEqual({ status: 200, json: { ok: true, code: expect.any(String) } });
      stack.codes.push((allowed.json as { code: string }).code);
    }, 60_000);
  },
  async (keys) => whyFunctionUnavailable(keys, "invite"),
);
