// The sweep-deadlines Edge Function served by the local Supabase stack: called with the service role key, it
// finishes a first-deck match whose deadline has passed; called with the anon key, it is refused and runs
// nothing. Without a running stack and `supabase functions serve`, one test says so and how to start them.
import { hostCreate } from "@terminal-dusk/host";
import type { MatchDeadline } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { expect, it } from "vitest";
import type { StackKeys } from "./migrations/localStack.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { NOW } from "./test/match.ts";
import { freshMatchId, onLocalStack, putIn, writeOf } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";

await onLocalStack(
  "the sweep-deadlines Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    const game = stackGame(keys);

    /** A first-deck lossOnTime match made at NOW (long past), so its one-day deadlines have passed. */
    async function dueMatch(): Promise<string> {
      const matchId = freshMatchId();
      const players = { lio: game.users[0]!.id, sae: game.users[1]!.id };
      const deadline: MatchDeadline = { rule: "lossOnTime", days: 1 };
      const config = { ...firstDeckConfig(), matchId, players, deadline };
      const made = hostCreate(firstDeckRuleset, config, `seed-${matchId}`, NOW);
      if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
      game.matchIds.push(matchId);
      await putIn(game.service, writeOf(made.value));
      return matchId;
    }

    it("a call with the service role key finishes a due match: 200 with the counts, and the match is over", async () => {
      const matchId = await dueMatch();
      const reply = await callFunction(keys, "sweep-deadlines", { method: "POST", token: keys.serviceKey });
      expect(reply.status).toBe(200);
      // Other test files' matches on the same stack may be due too, so only this match's own count is pinned.
      const count = expect.any(Number);
      expect(reply.json).toEqual({ results: { extended: count, timedOut: count, conflict: count, skipped: count } });
      expect((reply.json as { results: { timedOut: number } }).results.timedOut).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(reply.json)).not.toContain(matchId);
      const stored = await new SupabaseStore(game.service).load(matchId);
      expect(stored?.record.status.kind).toBe("over");
    }, 60_000);

    it("a call with the anon key is refused with 401, and the due match is untouched", async () => {
      const matchId = await dueMatch();
      const before = await new SupabaseStore(game.service).load(matchId);
      const reply = await callFunction(keys, "sweep-deadlines", { method: "POST", token: keys.anonKey });
      expect(reply.status).toBe(401);
      expect(await new SupabaseStore(game.service).load(matchId)).toEqual(before);
      expect(before?.record.status.kind).toBe("active");
    }, 60_000);
  },
  (keys) => whyFunctionUnavailable(keys, "sweep-deadlines", { method: "GET", status: 405 }),
);
