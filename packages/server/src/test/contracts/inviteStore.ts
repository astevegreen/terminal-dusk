// The InviteStore contract: what both MemoryInviteStore and SupabaseInviteStore must do, checked only through
// the ports, so one suite runs against the fake (inviteStore.contract.test.ts) and the real tables
// (stores.contract.stack.test.ts).
import type { MatchConfig, PlayerId } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import type { Invite, InviteStore } from "../../inviteStore.ts";
import type { MatchStore, MatchWrite } from "../../store.ts";

/** What one contract test works with; `setup` gives a fresh one at the start of each test. */
export type InviteStoreHarness = {
  store: InviteStore;
  /** Where `accept` stores the match, read through its `load`. */
  matches: MatchStore;
  host: PlayerId;
  joiner: PlayerId;
  third: PlayerId;
  /** A fresh, unused invite code. */
  code(): string;
  /** A new game at seq 0 between `players`, with a fresh id, not stored. */
  write(players: MatchConfig["players"]): MatchWrite;
};

/** Registers the InviteStore contract tests; call it inside a `describe`. */
export function inviteStoreContract(setup: () => InviteStoreHarness, timeout?: number): void {
  const invite = (h: InviteStoreHarness, code = h.code()): Invite => ({
    code,
    host: h.host,
    sides: { mode: "host", hostSide: "sae" },
    createdAt: 1_700_000_000_123,
  });
  const gameFor = (h: InviteStoreHarness, joiner = h.joiner) => h.write({ lio: joiner, sae: h.host });

  it(
    "save stores a new invite unused, find gives it back, and find gives null for an unknown code",
    async () => {
      const h = setup();
      const made = invite(h);
      expect(await h.store.save(made)).toBe("saved");
      expect(await h.store.find(made.code)).toEqual({ ...made, accepted: null });
      expect(await h.store.find(h.code())).toBeNull();
    },
    timeout,
  );

  it(
    "save never overwrites a code, used or not: it reports a clash and the first invite stays",
    async () => {
      const h = setup();
      const made = invite(h);
      await h.store.save(made);
      const other = { ...made, host: h.third, sides: { mode: "random" as const } };
      expect(await h.store.save(other)).toBe("clash");
      expect(await h.store.accept(made.code, h.joiner, gameFor(h))).toBe("accepted");
      expect(await h.store.save(other)).toBe("clash");
      expect((await h.store.find(made.code))!.host).toBe(h.host);
    },
    timeout,
  );

  it(
    "accept marks the invite used by the joiner with the match id, and the match loads",
    async () => {
      const h = setup();
      const made = invite(h);
      await h.store.save(made);
      const game = gameFor(h);
      const matchId = game.record.matchId;
      expect(await h.store.accept(made.code, h.joiner, game)).toBe("accepted");
      expect(await h.store.find(made.code)).toEqual({ ...made, accepted: { joiner: h.joiner, matchId } });
      expect(await h.matches.load(matchId)).toEqual({ record: game.record, secret: game.secret });
    },
    timeout,
  );

  it(
    "accept on a used or unknown invite reports it unavailable and stores no match",
    async () => {
      const h = setup();
      const made = invite(h);
      await h.store.save(made);
      const first = gameFor(h);
      await h.store.accept(made.code, h.joiner, first);
      const late = gameFor(h, h.third);
      const unknown = gameFor(h, h.third);
      expect(await h.store.accept(made.code, h.third, late)).toBe("unavailable");
      expect(await h.store.accept(h.code(), h.third, unknown)).toBe("unavailable");
      expect(await h.matches.load(late.record.matchId)).toBeNull();
      expect(await h.matches.load(unknown.record.matchId)).toBeNull();
      expect((await h.store.find(made.code))!.accepted).toEqual({ joiner: h.joiner, matchId: first.record.matchId });
    },
    timeout,
  );
}
