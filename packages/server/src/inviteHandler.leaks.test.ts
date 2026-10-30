import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { handleInvite } from "./inviteHandler.ts";
import type { SideMode } from "./inviteStore.ts";
import type { HttpReply } from "./submitHandler.ts";
import { json, post } from "./test/handler.ts";
import { inviteHandlerWorld } from "./test/inviteHandler.ts";
import { HOST } from "./test/invites.ts";
import { leaksIn } from "./test/leaks.ts";

const MODES: { sides: SideMode; side?: Side }[] = [
  { sides: { mode: "random" } },
  { sides: { mode: "host", hostSide: "lio" } },
  { sides: { mode: "host", hostSide: "sae" } },
  { sides: { mode: "invitee" }, side: "sae" },
];

describe("invite handler: no reply gives away the seed, the secret or the host's id", () => {
  for (const mode of MODES) {
    it(`create, preview, join and every refusal after it, for side mode ${JSON.stringify(mode.sides)}`, async () => {
      const world = inviteHandlerWorld();
      const deps = world.handlerDeps;
      const replies: HttpReply[] = [];
      const send = async (token: string, body: unknown) => {
        const reply = await handleInvite(deps, post(token, body));
        replies.push(reply);
        return reply;
      };
      const { code } = json(await send("token-host", { action: "create", sides: mode.sides })) as { code: string };
      await send("token-joiner", { action: "preview", code });
      await send("token-host", { action: "join", code, side: mode.side });
      const joined = await send("token-joiner", { action: "join", code, side: mode.side });
      expect(joined.status).toBe(200);
      await send("token-third", { action: "preview", code });
      await send("token-third", { action: "join", code, side: mode.side });

      const { matchId } = json(joined) as { matchId: string };
      const { secret } = world.matches.stored(matchId)!;
      expect(secret.seed).toBe("seed-1");
      for (const reply of replies) {
        expect(leaksIn(JSON.stringify(reply), secret), reply.body).toEqual([]);
        // The leak helper does not look for player ids, so the host's id is checked here.
        expect(reply.body).not.toContain(HOST);
        expect(JSON.stringify(reply.headers)).not.toContain(HOST);
      }
    });
  }
});
