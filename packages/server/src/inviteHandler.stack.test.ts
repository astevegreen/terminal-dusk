// The invite Edge Function served by the local Supabase stack: two signed-in users create, preview and join an
// invite, the joiner reads their own frame (as themselves, so the read rules are exercised) and their first
// answer goes through the submit function and is saved. Without a running stack and `supabase functions serve`
// for both functions, one test says so and how to start them.
import type { Frame } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import type { StackKeys } from "./migrations/localStack.ts";
import { callFunction, whyFunctionUnavailable } from "./test/functions.ts";
import { inviteStack } from "./test/inviteStack.ts";
import { accessToken, onLocalStack, storedRows } from "./test/stack.ts";

await onLocalStack(
  "the invite Edge Function on the local Supabase stack",
  (keys: StackKeys) => {
    const stack = inviteStack(keys);
    const call = async (token: string, body: unknown) => callFunction(keys, "invite", { method: "POST", token, body });

    it("create, preview and join as two signed-in users; the joiner's first answer through submit is saved", async () => {
      const hostToken = await accessToken(stack.host);
      const joinerToken = await accessToken(stack.joiner);

      const create = await call(hostToken, { action: "create", sides: { mode: "invitee" } });
      expect(create).toEqual({ status: 200, json: { ok: true, code: expect.any(String) } });
      const { code } = create.json as { code: string };
      stack.codes.push(code);

      const preview = await call(joinerToken, { action: "preview", code });
      expect(preview).toEqual({ status: 200, json: { ok: true, sides: { mode: "invitee" } } });

      const own = await call(hostToken, { action: "join", code, side: "lio" });
      expect(own.status).toBe(409);

      const join = await call(joinerToken, { action: "join", code, side: "sae" });
      expect(join).toEqual({ status: 200, json: { ok: true, matchId: expect.any(String), side: "sae" } });
      const { matchId } = join.json as { matchId: string };
      stack.matchIds.push(matchId);
      for (const reply of [create, preview, own, join]) expect(JSON.stringify(reply.json)).not.toContain(stack.host.id);

      // The joiner reads their own frame from match_view, signed in as themselves (never match_secret).
      const { data, error } = await stack.joiner.db
        .from("match_view")
        .select("frame")
        .eq("match_id", matchId)
        .eq("viewer", "sae");
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      const frame = (data![0] as { frame: Frame }).frame;
      const decision = frame.decision!;
      const card = frame.view.mine!.hand[0]!;
      expect(decision.side).toBe("sae");

      const submission = { decisionId: decision.id, expectedSeq: 0, value: { kind: "chooseCard", card } };
      const answered = await callFunction(keys, "submit", {
        method: "POST",
        token: joinerToken,
        body: { matchId, submission },
      });
      expect(answered).toEqual({ status: 200, json: { ok: true, seq: 1 } });
      const stored = await storedRows(stack.service, matchId);
      expect(stored.match[0]!.seq).toBe(1);
      expect(stored.match[0]!.lio_player).toBe(stack.host.id);
      expect(stored.match[0]!.sae_player).toBe(stack.joiner.id);
    }, 60_000);

    it("a signed-out call gets 401 notSignedIn and creates no invite", async () => {
      const reply = await call(keys.anonKey, { action: "create", sides: { mode: "random" } });
      expect(reply).toEqual({
        status: 401,
        json: { ok: false, error: { code: "notSignedIn", message: expect.any(String) } },
      });
    }, 60_000);
  },
  async (keys) => (await whyFunctionUnavailable(keys, "invite")) ?? (await whyFunctionUnavailable(keys, "submit")),
);
