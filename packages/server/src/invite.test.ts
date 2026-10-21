import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { InviteDeps } from "./invite.ts";
import type { SideMode } from "./inviteStore.ts";
import { submit } from "./submit.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";
import type { InviteWorld } from "./test/invites.ts";

/** Creates an invite as the host and returns its code. */
async function hostInvite(world: InviteWorld, sides: SideMode): Promise<string> {
  const made = await createInvite(world.deps, { host: HOST, sides, now: INVITE_NOW });
  if (!made.ok) throw new Error(`createInvite refused: ${made.error.code}`);
  return made.value.code;
}

/** Answers the first waiting decision of the match with its first legal answer, through submit. */
async function playFirstAnswer(world: InviteWorld, matchId: string) {
  const loaded = (await world.matches.load(matchId))!;
  const side = SIDES.find((s) => pendingFor(loaded.secret.state, s) !== null)!;
  const decision = pendingFor(loaded.secret.state, side)!;
  const value = legalAnswers(firstDeckRuleset, loaded.secret.state, side)[0];
  const body = { decisionId: decision.id, expectedSeq: loaded.record.seq, value };
  const player = loaded.record.players[side];
  return submit(world.submitDeps, { matchId, player, body, now: INVITE_NOW + 2 });
}

const MODES: { name: string; sides: SideMode; randomHostSide?: Side; side?: Side; joinerSide: Side }[] = [
  { name: "host chooses LIO: the joiner gets SAE", sides: { mode: "host", hostSide: "lio" }, joinerSide: "sae" },
  { name: "host chooses SAE: the joiner gets LIO", sides: { mode: "host", hostSide: "sae" }, joinerSide: "lio" },
  { name: "invitee chooses LIO", sides: { mode: "invitee" }, side: "lio", joinerSide: "lio" },
  { name: "invitee chooses SAE", sides: { mode: "invitee" }, side: "sae", joinerSide: "sae" },
  { name: "random draw gives the host LIO", sides: { mode: "random" }, randomHostSide: "lio", joinerSide: "sae" },
  { name: "random draw gives the host SAE", sides: { mode: "random" }, randomHostSide: "sae", joinerSide: "lio" },
];

describe("joinInvite: the players end up on the sides the mode says, and the game is playable", () => {
  for (const mode of MODES) {
    it(mode.name, async () => {
      const world = inviteWorld(mode.randomHostSide);
      const code = await hostInvite(world, mode.sides);
      expect(await previewInvite(world.deps, code)).toEqual({ ok: true, value: { sides: mode.sides } });
      const joined = await joinInvite(world.deps, { code, player: JOINER, side: mode.side, now: INVITE_NOW + 1 });
      if (!joined.ok) throw new Error(`joinInvite refused: ${joined.error.code}`);
      expect(joined.value.side).toBe(mode.joinerSide);
      const hostSide = mode.joinerSide === "lio" ? "sae" : "lio";
      const stored = world.matches.stored(joined.value.matchId)!;
      expect(stored.record.players).toEqual({ [mode.joinerSide]: JOINER, [hostSide]: HOST });
      expect(stored.record.ruleset).toBe(firstDeckRuleset.id);
      expect(stored.secret.seed).toBe("seed-1");
      const answered = await playFirstAnswer(world, joined.value.matchId);
      expect(answered).toMatchObject({ ok: true, value: { seq: 1 } });
      expect(world.matches.stored(joined.value.matchId)!.record.seq).toBe(1);
    });
  }

  it("the invite is used afterwards: it can no longer be previewed or joined, and records who joined", async () => {
    const world = inviteWorld();
    const code = await hostInvite(world, { mode: "random" });
    const joined = await joinInvite(world.deps, { code, player: JOINER, now: INVITE_NOW + 1 });
    expect(joined.ok).toBe(true);
    expect(await world.invites.find(code)).toEqual({
      code,
      host: HOST,
      sides: { mode: "random" },
      createdAt: INVITE_NOW,
      accepted: { joiner: JOINER, matchId: "match-1" },
    });
    expect(await previewInvite(world.deps, code)).toMatchObject({ ok: false, error: { code: "inviteNotFound" } });
    const again = await joinInvite(world.deps, { code, player: "third-tess", now: INVITE_NOW + 2 });
    expect(again).toMatchObject({ ok: false, error: { code: "inviteNotFound" } });
  });

  it("returns hostCreate's effects: a notice for each player with a decision waiting", async () => {
    const world = inviteWorld();
    const code = await hostInvite(world, { mode: "host", hostSide: "lio" });
    const joined = await joinInvite(world.deps, { code, player: JOINER, now: INVITE_NOW + 1 });
    if (!joined.ok) throw new Error(joined.error.code);
    const { secret, record } = (await world.matches.load(joined.value.matchId))!;
    const waiting = SIDES.filter((side) => pendingFor(secret.state, side) !== null);
    expect(waiting.length).toBeGreaterThan(0);
    expect(joined.value.effects).toEqual(waiting.map((side) => ({ notify: record.players[side] })));
  });
});

describe("joinInvite: two players join the same code at once", () => {
  it("exactly one gets the match, the other gets inviteNotFound, and only one match exists", async () => {
    const world = inviteWorld();
    const code = await hostInvite(world, { mode: "random" });
    // Both calls find the open invite before either accepts it.
    let found = 0;
    let release: () => void = () => {};
    const bothFound = new Promise<void>((resolve) => (release = resolve));
    const invites = world.invites;
    const deps: InviteDeps = {
      ...world.deps,
      invites: {
        save: (invite) => invites.save(invite),
        accept: (c, joiner, write) => invites.accept(c, joiner, write),
        find: async (c) => {
          const invite = await invites.find(c);
          if (++found === 2) release();
          await bothFound;
          return invite;
        },
      },
    };
    const results = await Promise.all([
      joinInvite(deps, { code, player: "first-fay", now: INVITE_NOW + 1 }),
      joinInvite(deps, { code, player: "second-sol", now: INVITE_NOW + 1 }),
    ]);
    expect(found).toBe(2);
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toEqual([{ ok: false, error: expect.objectContaining({ code: "inviteNotFound" }) }]);
    const stored = ["match-1", "match-2"].filter((id) => world.matches.stored(id) !== null);
    expect(stored).toHaveLength(1);
    expect(winners[0]).toMatchObject({ ok: true, value: { matchId: stored[0] } });
  });
});
