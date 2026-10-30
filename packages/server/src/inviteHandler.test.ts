import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import { handleInvite } from "./inviteHandler.ts";
import type { SideMode } from "./inviteStore.ts";
import { handleSubmit } from "./submitHandler.ts";
import { json, post } from "./test/handler.ts";
import { inviteHandlerWorld, tokenOf } from "./test/inviteHandler.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";

const MODES: { name: string; sides: SideMode; randomHostSide?: Side; side?: Side }[] = [
  { name: "host chooses LIO", sides: { mode: "host", hostSide: "lio" } },
  { name: "host chooses SAE", sides: { mode: "host", hostSide: "sae" } },
  { name: "invitee chooses LIO", sides: { mode: "invitee" }, side: "lio" },
  { name: "invitee chooses SAE", sides: { mode: "invitee" }, side: "sae" },
  { name: "random draw gives the host LIO", sides: { mode: "random" }, randomHostSide: "lio" },
  { name: "random draw gives the host SAE", sides: { mode: "random" }, randomHostSide: "sae" },
];

/** What O5a itself returns for the same calls, in a fresh world with the same generators. */
async function directly(mode: (typeof MODES)[number]) {
  const world = inviteWorld(mode.randomHostSide);
  const created = await createInvite(world.deps, { host: HOST, sides: mode.sides, now: INVITE_NOW + 1 });
  if (!created.ok) throw new Error(created.error.code);
  const { code } = created.value;
  const preview = await previewInvite(world.deps, code);
  const joined = await joinInvite(world.deps, { code, player: JOINER, side: mode.side, now: INVITE_NOW + 2 });
  if (!joined.ok) throw new Error(joined.error.code);
  return { code, preview, joined: joined.value, match: world.matches.stored(joined.value.matchId)! };
}

describe("invite handler: create, preview and join return what O5a returns, for each side mode", () => {
  for (const mode of MODES) {
    it(mode.name, async () => {
      const expected = await directly(mode);
      const world = inviteHandlerWorld(mode.randomHostSide);
      const created = await handleInvite(
        world.handlerDeps,
        post("token-host", { action: "create", sides: mode.sides }),
      );
      expect(created.status).toBe(200);
      expect(json(created)).toEqual({ ok: true, code: expected.code });

      const preview = await handleInvite(
        world.handlerDeps,
        post("token-joiner", { action: "preview", code: expected.code }),
      );
      expect(preview.status).toBe(200);
      if (!expected.preview.ok) throw new Error("O5a refused the preview");
      // The preview shows the mode and, when the host chose, the host's side.
      expect(json(preview)).toEqual({ ok: true, sides: expected.preview.value.sides });
      expect(json(preview)).toEqual({ ok: true, sides: mode.sides });

      const body =
        mode.side === undefined
          ? { action: "join", code: expected.code }
          : { action: "join", code: expected.code, side: mode.side };
      const joined = await handleInvite(world.handlerDeps, post("token-joiner", body));
      expect(joined.status).toBe(200);
      expect(json(joined)).toEqual({ ok: true, matchId: expected.joined.matchId, side: expected.joined.side });
      expect(world.matches.stored(expected.joined.matchId)).toEqual(expected.match);
    });
  }
});

describe("invite handler: the created match is playable through the submit handler", () => {
  for (const mode of MODES) {
    it(mode.name, async () => {
      const world = inviteHandlerWorld(mode.randomHostSide);
      const created = json(
        await handleInvite(world.handlerDeps, post("token-host", { action: "create", sides: mode.sides })),
      ) as { code: string };
      const joined = json(
        await handleInvite(
          world.handlerDeps,
          post("token-joiner", { action: "join", code: created.code, side: mode.side }),
        ),
      ) as { matchId: string; side: Side };
      const loaded = (await world.matches.load(joined.matchId))!;
      const side = SIDES.find((s) => pendingFor(loaded.secret.state, s) !== null)!;
      const decision = pendingFor(loaded.secret.state, side)!;
      const value = legalAnswers(firstDeckRuleset, loaded.secret.state, side)[0];
      const submission = { decisionId: decision.id, expectedSeq: 0, value };
      const token = tokenOf(loaded.record.players[side]);
      const reply = await handleSubmit(world.submitHandlerDeps, post(token, { matchId: joined.matchId, submission }));
      expect(reply.status).toBe(200);
      expect(json(reply)).toEqual({ ok: true, seq: 1 });
      expect(world.matches.stored(joined.matchId)!.record.seq).toBe(1);
    });
  }
});

describe("invite handler: the host and the joiner always come from sign-in, never from the body", () => {
  it("a host or player named in the body is ignored", async () => {
    const world = inviteHandlerWorld();
    const sides = { mode: "host", hostSide: "lio" };
    const created = await handleInvite(
      world.handlerDeps,
      post("token-host", { action: "create", sides, host: JOINER }),
    );
    const { code } = json(created) as { code: string };
    expect((await world.invites.find(code))!.host).toBe(HOST);
    const joined = await handleInvite(
      world.handlerDeps,
      post("token-third", { action: "join", code, player: JOINER, joiner: JOINER }),
    );
    expect(joined.status).toBe(200);
    const { matchId } = json(joined) as { matchId: string };
    expect(world.matches.stored(matchId)!.record.players).toEqual({ lio: HOST, sae: "third-tess" });
  });
});
