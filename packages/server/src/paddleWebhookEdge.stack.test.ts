// The paddle-webhook Edge Function served by the local Supabase stack: Paddle calls it with no signed-in caller,
// so a request must reach the function itself, which refuses it for want of a signature. No webhook secret needs
// to be configured for this. Without a running stack and `supabase functions serve`, one test says so and how to
// start them.
import { expect, it } from "vitest";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { onLocalStack } from "./test/stack.ts";

await onLocalStack(
  "the paddle-webhook Edge Function on the local Supabase stack",
  (keys) => {
    it("takes a POST with no signed-in caller and answers 401 for want of a signature", async () => {
      const reply = await callFunction(keys, "paddle-webhook", { method: "POST", body: {} });
      expect(reply.status).toBe(401);
      expect(reply.json).toMatchObject({ ok: false, error: { code: "badSignature" } });
    }, 60_000);
  },
  // The function takes only POST, so it answers the probe's GET with 405.
  (keys) => whyFunctionUnavailable(keys, "paddle-webhook", { method: "GET", status: 405 }),
);
