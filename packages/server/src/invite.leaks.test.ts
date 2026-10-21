import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { SideMode } from "./inviteStore.ts";
import { leaksIn } from "./test/leaks.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";

describe("invites: no result gives away a seed, the secret or the host's id", () => {
  for (const sides of [{ mode: "random" }, { mode: "host", hostSide: "lio" }, { mode: "invitee" }] as SideMode[]) {
    it(`every value and error from createInvite, previewInvite and joinInvite is clean (${sides.mode})`, async () => {
      const world = inviteWorld();
      const { deps } = world;
      const created = await createInvite(deps, { host: HOST, sides, now: INVITE_NOW });
      if (!created.ok) throw new Error(created.error.code);
      const { code } = created.value;
      const side = sides.mode === "invitee" ? "sae" : undefined;
      const results: unknown[] = [
        created,
        await createInvite(deps, { host: "", sides, now: INVITE_NOW }),
        await createInvite(deps, { host: HOST, sides, now: -1 }),
        await createInvite(deps, { host: HOST, sides: { mode: "nope" } as unknown as SideMode, now: INVITE_NOW }),
        await previewInvite(deps, code),
        await previewInvite(deps, "NOSUCHCD"),
        await joinInvite(deps, { code, player: "", now: INVITE_NOW }),
        await joinInvite(deps, { code, player: JOINER, now: -1 }),
        await joinInvite(deps, { code, player: JOINER, side: "x" as "lio", now: INVITE_NOW }),
        await joinInvite(deps, { code: "NOSUCHCD", player: JOINER, now: INVITE_NOW }),
        await joinInvite(deps, { code, player: HOST, now: INVITE_NOW }),
        await joinInvite(deps, {
          code,
          player: JOINER,
          side: sides.mode === "invitee" ? undefined : "lio",
          now: INVITE_NOW,
        }),
        await joinInvite({ ...deps, matchId: () => "" }, { code, player: JOINER, side, now: INVITE_NOW }),
      ];
      const joined = await joinInvite(deps, { code, player: JOINER, side, now: INVITE_NOW + 1 });
      if (!joined.ok) throw new Error(joined.error.code);
      results.push(
        await previewInvite(deps, code),
        await joinInvite(deps, { code, player: "late-lu", now: INVITE_NOW }),
      );
      const secret = world.matches.stored(joined.value.matchId)!.secret;
      // The effects stay on the server (adapters do not send them to clients), and they name the players by design.
      const { effects, ...toClient } = joined.value;
      expect(effects.length).toBeGreaterThan(0);
      const text = JSON.stringify([...results, toClient, effects]);
      expect(leaksIn(text, secret)).toEqual([]);
      const clientText = JSON.stringify([...results, toClient]);
      expect(clientText).not.toContain(HOST);
      expect(clientText).toContain(code);
    });
  }
});
