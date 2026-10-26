import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import { handleInvite } from "./inviteHandler.ts";
import type { SideMode } from "./inviteStore.ts";
import { handleSubmit } from "./submitHandler.ts";
import { post } from "./test/handler.ts";
import { body, inviteHandlerWorld } from "./test/inviteHandler.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";

const MODES: { name: string; sides: SideMode; randomHostSide?: Side; side?: Side }[] = [
  { name: "host chooses LIO", sides: { mode: "host", hostSide: "lio" } },
  { name: "host chooses SAE", sides: { mode: "host", hostSide: "sae" } },
  { name: "invitee chooses LIO", sides: { mode: "invitee" }, side: "lio" },
  { name: "invitee chooses SAE", sides: { mode: "invitee" }, side: "sae" },
  { name: "random draw gives the host LIO", sides: { mode: "random" }, randomHostSide: "lio" },
  { name: "random draw gives the host SAE", sides: { mode: "random" }, randomHostSide: "sae" },
];

const TOKEN_OF: Record<string, string> = { [HOST]: "token-host", [JOINER]: "token-joiner" };

/** What O5a itself returns for the same calls, on a fresh world with the same generators. */
async function directly(sides: SideMode, randomHostSide: Side, side: Side | undefined) {
  const { deps } = inviteWorld(randomHostSide);
  const made = await createInvite(deps, { host: HOST, sides, platform: "web", now: INVITE_NOW + 1 });
  if (!made.ok) throw new Error("createInvite refused");
  const preview = await previewInvite(deps, made.value.code);
  const joined = await joinInvite(deps, { code: made.value.code, player: JOINER, side, now: INVITE_NOW + 3 });
  return { made, preview, joined };
}

describe("invite handler: create, preview and join return what O5a returns, for each side mode", () => {
  for (const mode of MODES) {
    it(`${mode.name}: the replies match O5a's, and the created match is playable through the submit handler`, async () => {
      const randomHostSide = mode.randomHostSide ?? "lio";
      const w = inviteHandlerWorld(randomHostSide);
      const expected = await directly(mode.sides, randomHostSide, mode.side);
      if (!expected.made.ok || !expected.preview.ok || !expected.joined.ok) throw new Error("O5a refused");

      const create = await handleInvite(
        w.deps,
        post("token-host", { action: "create", sides: mode.sides, platform: "web" }),
      );
      expect(create.status).toBe(200);
      expect(body(create)).toEqual({ ok: true, code: expected.made.value.code });
      const code = expected.made.value.code;

      const preview = await handleInvite(w.deps, post("token-joiner", { action: "preview", code }));
      expect(preview.status).toBe(200);
      expect(body(preview)).toEqual({ ok: true, sides: expected.preview.value.sides });
      expect(body(preview)).toEqual({ ok: true, sides: mode.sides });

      const joinBody = mode.side === undefined ? { action: "join", code } : { action: "join", code, side: mode.side };
      const join = await handleInvite(w.deps, post("token-joiner", joinBody));
      expect(join.status).toBe(200);
      const { matchId, side } = expected.joined.value;
      expect(body(join)).toEqual({ ok: true, matchId, side });

      const loaded = (await w.world.matches.load(matchId))!;
      expect(loaded.record.players[side]).toBe(JOINER);
      // The stack test answers this way: the joiner waits on a pick, and the first card of their hand is legal.
      const joinerCard = loaded.secret.state.private[side].hand[0];
      expect(pendingFor(loaded.secret.state, side)).not.toBeNull();
      expect(legalAnswers(firstDeckRuleset, loaded.secret.state, side)).toContainEqual({
        kind: "chooseCard",
        card: joinerCard,
      });
      const mover = SIDES.find((s) => pendingFor(loaded.secret.state, s) !== null)!;
      const decision = pendingFor(loaded.secret.state, mover)!;
      const value = legalAnswers(firstDeckRuleset, loaded.secret.state, mover)[0];
      const submission = { decisionId: decision.id, expectedSeq: 0, value };
      const token = TOKEN_OF[loaded.record.players[mover]]!;
      const played = await handleSubmit(w.submitDeps, post(token, { matchId, submission }));
      expect(body(played)).toEqual({ ok: true, seq: 1 });
      expect(played.status).toBe(200);
    });
  }
});
