import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import type { HttpReply } from "./http.ts";
import { handleInvite } from "./inviteHandler.ts";
import type { SideMode } from "./inviteStore.ts";
import { post } from "./test/handler.ts";
import { body, inviteHandlerWorld } from "./test/inviteHandler.ts";
import { HOST } from "./test/invites.ts";
import { leaksIn } from "./test/leaks.ts";

const MODES: { sides: SideMode; side?: Side }[] = [
  { sides: { mode: "random" } },
  { sides: { mode: "host", hostSide: "lio" } },
  { sides: { mode: "host", hostSide: "sae" } },
  { sides: { mode: "invitee" }, side: "sae" },
];

describe("invite handler: no reply gives away a seed, the secret or the host's id", () => {
  for (const mode of MODES) {
    it(`${JSON.stringify(mode.sides)}: create, preview and join replies (and their refusals) leak nothing`, async () => {
      const w = inviteHandlerWorld();
      const replies: HttpReply[] = [];
      const send = async (token: string, sent: unknown) => {
        const reply = await handleInvite(w.deps, post(token, sent));
        replies.push(reply);
        return reply;
      };
      const create = await send("token-host", { action: "create", sides: mode.sides, platform: "web" });
      const { code } = body(create) as { code: string };
      await send("token-joiner", { action: "preview", code });
      await send("token-host", { action: "join", code });
      const joinBody = mode.side === undefined ? { action: "join", code } : { action: "join", code, side: mode.side };
      const join = await send("token-joiner", joinBody);
      expect(join.status).toBe(200);
      await send("token-third", { action: "join", code });
      await send("token-third", { action: "preview", code });

      const { matchId } = body(join) as { matchId: string };
      const secret = (await w.world.matches.load(matchId))!.secret;
      for (const reply of replies) {
        expect(leaksIn(reply.body, secret)).toEqual([]);
        expect(reply.body).not.toContain(HOST);
        expect(reply.body).not.toContain(secret.seed);
      }
    });
  }
});
