// The seen Edge Function served by the local Supabase stack: a player's seen call marks their queued turn alert
// seen, so the sweep no longer finds it. Without a running stack and `supabase functions serve`, one test says
// so and how to start them.
import { expect, it } from "vitest";
import { TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
import { SupabaseNotifyStore } from "./supabaseNotifyStore.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { accessToken, onLocalStack } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";

// Far from the other stack tests' times.
const T = 6_000_000_000_000;

await onLocalStack(
  "the seen Edge Function on the local Supabase stack",
  (keys) => {
    const game = stackGame(keys);

    it("a player's seen call answers 204 and marks their turn alert seen, so it is no longer due", async () => {
      const matchId = (await game.stored()).record.matchId;
      const [alice, bob] = [game.users[0]!, game.users[1]!];
      const notify = new SupabaseNotifyStore(game.service);
      await notify.queue([
        { matchId, player: alice.id, seq: 0, queuedAt: T, waitingSeq: 0 },
        { matchId, player: bob.id, seq: 0, queuedAt: T, waitingSeq: 0 },
      ]);

      const reply = await callFunction(keys, "seen", {
        method: "POST",
        token: await accessToken(alice),
        body: { matchId, seq: 0 },
      });

      expect(reply).toEqual({ status: 204, json: null });
      const due = (await notify.due(T + TURN_ALERT_DELAY_MS)).filter((a) => a.matchId === matchId);
      expect(due).toEqual([{ matchId, player: bob.id, seq: 0, queuedAt: T, waitingSeq: 0 }]);
    }, 60_000);

    it("a signed-out call is refused with 401, and the alert stays due", async () => {
      const matchId = (await game.stored()).record.matchId;
      const alice = game.users[0]!;
      const notify = new SupabaseNotifyStore(game.service);
      await notify.queue([{ matchId, player: alice.id, seq: 0, queuedAt: T, waitingSeq: 0 }]);

      const reply = await callFunction(keys, "seen", { method: "POST", body: { matchId, seq: 0 } });

      expect(reply.status).toBe(401);
      const due = (await notify.due(T + TURN_ALERT_DELAY_MS)).filter((a) => a.matchId === matchId);
      expect(due).toEqual([{ matchId, player: alice.id, seq: 0, queuedAt: T, waitingSeq: 0 }]);
    }, 60_000);
  },
  (keys) => whyFunctionUnavailable(keys, "seen"),
);
