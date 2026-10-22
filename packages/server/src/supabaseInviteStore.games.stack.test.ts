// Private games through the Supabase stores on the local Supabase stack: for each side mode, createInvite,
// previewInvite and joinInvite create a match whose rows are O2's rows for seq 0, and the first answer through
// submit with a SupabaseStore is saved. Without a running local stack, one test says so and how to start it.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { SideMode } from "./inviteStore.ts";
import { rowsFor } from "./rows.ts";
import { submit } from "./submit.ts";
import { SupabaseInviteStore } from "./supabaseInviteStore.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { expectedStart, inviteStack } from "./test/inviteStack.ts";
import { onLocalStack, writeOf } from "./test/stack.ts";
import { expectStoredAs } from "./test/stackGame.ts";
import { recording } from "./test/stores.ts";

const NOW = 1_700_000_000_000;

const MODES: { name: string; sides: SideMode; randomHostSide?: Side; side?: Side; joinerSide: Side }[] = [
  { name: "host chooses LIO", sides: { mode: "host", hostSide: "lio" }, joinerSide: "sae" },
  { name: "host chooses SAE", sides: { mode: "host", hostSide: "sae" }, joinerSide: "lio" },
  { name: "invitee chooses LIO", sides: { mode: "invitee" }, side: "lio", joinerSide: "lio" },
  { name: "invitee chooses SAE", sides: { mode: "invitee" }, side: "sae", joinerSide: "sae" },
  { name: "random draw gives the host LIO", sides: { mode: "random" }, randomHostSide: "lio", joinerSide: "sae" },
  { name: "random draw gives the host SAE", sides: { mode: "random" }, randomHostSide: "sae", joinerSide: "lio" },
];

await onLocalStack("SupabaseInviteStore on the local Supabase stack: invites for each side mode", (keys) => {
  const stack = inviteStack(keys);

  it.each(MODES)(
    "$name: the joined match's rows are O2's rows for seq 0, and the first answer through submit is saved",
    async (mode) => {
      const deps = stack.deps(mode.randomHostSide);
      const host = stack.host.id;
      const joiner = stack.joiner.id;
      const made = await createInvite(deps, { host, sides: mode.sides, now: NOW });
      if (!made.ok) throw new Error(`createInvite refused: ${made.error.code}`);
      const { code } = made.value;
      expect(await previewInvite(deps, code)).toEqual({ ok: true, value: { sides: mode.sides } });

      const joined = await joinInvite(deps, { code, player: joiner, side: mode.side, now: NOW + 1 });
      if (!joined.ok) throw new Error(`joinInvite refused: ${joined.error.code}`);
      const { matchId, side } = joined.value;
      expect(side).toBe(mode.joinerSide);
      const hostSide = side === "lio" ? "sae" : "lio";
      const players = { [side]: joiner, [hostSide]: host } as Record<Side, string>;
      const start = expectedStart(matchId, players, NOW + 1);
      await expectStoredAs(stack.service, writeOf(start), []);
      expect(await new SupabaseInviteStore(stack.service).find(code)).toEqual({
        code,
        host,
        sides: mode.sides,
        createdAt: NOW,
        accepted: { joiner, matchId },
      });
      expect(await previewInvite(deps, code)).toMatchObject({ ok: false, error: { code: "inviteNotFound" } });

      const { store, saved } = recording(new SupabaseStore(stack.service));
      const submitDeps = {
        store,
        ruleset: (id: string) => (id === firstDeckRuleset.id ? firstDeckRuleset : undefined),
      };
      const waiting = SIDES.find((s) => pendingFor(start.secret.state, s) !== null)!;
      const decision = pendingFor(start.secret.state, waiting)!;
      const value = legalAnswers(firstDeckRuleset, start.secret.state, waiting)[0];
      const body = { decisionId: decision.id, expectedSeq: 0, value };
      const answered = await submit(submitDeps, { matchId, player: players[waiting], body, now: NOW + 2 });
      expect(answered).toMatchObject({ ok: true, value: { seq: 1 } });
      expect(saved).toHaveLength(1);
      await expectStoredAs(stack.service, saved[0]!, rowsFor(writeOf(start)).events);
    },
    60_000,
  );
});
