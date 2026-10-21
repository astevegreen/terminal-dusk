// The submit Edge Function served by the local Supabase stack: a signed-in LIO player's legal answer is saved,
// and a stranger or a signed-out call is refused with every stored row unchanged. Without a running stack and
// `supabase functions serve`, one test says so and how to start them.
import { legalAnswers, pendingFor } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { HostResult } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { beforeAll, expect, it } from "vitest";
import type { StackKeys } from "./migrations/localStack.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { NOW } from "./test/match.ts";
import { freshMatchId, makeUser, onLocalStack, putIn, storedRows, writeOf } from "./test/stack.ts";
import type { TestUser } from "./test/stack.ts";
import { stackGame } from "./test/stackGame.ts";

const accessToken = async (user: TestUser): Promise<string> => {
  const { data } = await user.db.auth.getSession();
  if (!data.session) throw new Error("the test user has no session");
  return data.session.access_token;
};

await onLocalStack(
  "the submit Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    const game = stackGame(keys);
    let stranger: TestUser | undefined;
    beforeAll(async () => {
      stranger = await makeUser(keys, game.service, "stranger");
      game.users.push(stranger);
    }, 60_000);

    /** A first-deck match between the two test users, put in at seq 0. */
    async function firstDeckMatch(): Promise<HostResult> {
      const matchId = freshMatchId();
      const players = { lio: game.users[0]!.id, sae: game.users[1]!.id };
      const made = hostCreate(firstDeckRuleset, { ...firstDeckConfig(), matchId, players }, `seed-${matchId}`, NOW);
      if (!made.ok) throw new Error(`hostCreate failed: ${made.error.code}`);
      game.matchIds.push(matchId);
      await putIn(game.service, writeOf(made.value));
      return made.value;
    }

    /** LIO's first legal answer at seq 0. */
    function lioAnswer(start: HostResult): Record<string, unknown> {
      const decision = pendingFor(start.secret.state, "lio");
      const value = legalAnswers(firstDeckRuleset, start.secret.state, "lio")[0];
      if (!decision || value === undefined) throw new Error("LIO has nothing to answer at seq 0");
      return { decisionId: decision.id, expectedSeq: 0, value };
    }

    it("a signed-in LIO player's legal answer is saved: 200 with seq 1, and the stored match moves to seq 1", async () => {
      const start = await firstDeckMatch();
      const matchId = start.record.matchId;
      const reply = await callFunction(keys, "submit", {
        method: "POST",
        token: await accessToken(game.users[0]!),
        body: { matchId, submission: lioAnswer(start) },
      });
      expect(reply).toEqual({ status: 200, json: { ok: true, seq: 1 } });
      const stored = await storedRows(game.service, matchId);
      expect(stored.match[0]!.seq).toBe(1);
    }, 60_000);

    it("a signed-in stranger gets 403 notPlayer, and no stored row changes", async () => {
      const start = await firstDeckMatch();
      const matchId = start.record.matchId;
      const before = await storedRows(game.service, matchId);
      const reply = await callFunction(keys, "submit", {
        method: "POST",
        token: await accessToken(stranger!),
        body: { matchId, submission: lioAnswer(start) },
      });
      expect(reply).toEqual({
        status: 403,
        json: { ok: false, error: { code: "notPlayer", message: expect.any(String) } },
      });
      expect(await storedRows(game.service, matchId)).toEqual(before);
    }, 60_000);

    it("a signed-out call (the anon key, or no token at all) gets 401, and no stored row changes", async () => {
      const start = await firstDeckMatch();
      const matchId = start.record.matchId;
      const before = await storedRows(game.service, matchId);
      const body = { matchId, submission: lioAnswer(start) };
      const anon = await callFunction(keys, "submit", { method: "POST", token: keys.anonKey, body });
      expect(anon).toEqual({
        status: 401,
        json: { ok: false, error: { code: "notSignedIn", message: expect.any(String) } },
      });
      const none = await callFunction(keys, "submit", { method: "POST", token: null, body });
      expect(none.status).toBe(401);
      expect(await storedRows(game.service, matchId)).toEqual(before);
    }, 60_000);
  },
  (keys) => whyFunctionUnavailable(keys, "submit"),
);
