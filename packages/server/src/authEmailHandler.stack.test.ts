// The auth-email Edge Function served by the local Supabase stack: an unsigned call is refused with 401. Without
// a running stack and `supabase functions serve`, one test says so and how to start them.
import { expect, it } from "vitest";
import type { StackKeys } from "./migrations/localStack.ts";
import { payload } from "./test/authEmail.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { onLocalStack } from "./test/stack.ts";

await onLocalStack(
  "the auth-email Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    it("an unsigned hook call to the served function answers 401", async () => {
      const reply = await callFunction(keys, "auth-email", { method: "POST", body: JSON.parse(payload("magiclink")) });
      expect(reply.status).toBe(401);
      expect(reply.json).toEqual({ error: { http_code: 401, message: expect.any(String) } });
    });
  },
  (keys) => whyFunctionUnavailable(keys, "auth-email"),
);
