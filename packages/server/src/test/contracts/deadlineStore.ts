// The DeadlineStore contract: what both MemoryStore and SupabaseStore must do for the deadline sweep, checked only
// through the ports, so one suite runs against the fake (stores.contract.test.ts) and the real tables
// (stores.contract.stack.test.ts). `due` reads the stored next deadline (SupabaseStore's next_deadline column), so
// these checks also prove that column follows each commit and saveClock. `due` may see other tests' matches, so
// each check keeps only its own.
import type { DeadlineRule, HostResult, MatchRecord } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import type { DeadlineStore } from "../../deadlineStore.ts";
import type { MatchStore, MatchWrite } from "../../store.ts";
import { DAY } from "../deadlines.ts";
import { bodyFor } from "../match.ts";
import { answered } from "../stackGame.ts";
import { writeOf } from "../stack.ts";

/** What one contract test works with; `setup` gives a fresh one at the start of each test. */
export type DeadlineStoreHarness = {
  store: MatchStore & DeadlineStore;
  /** The two players, LIO first, as the matches name them. */
  players: [string, string];
  /** A new one-day match with `rule` made at `at` (both deadlines `at + DAY`) and a fresh id, not put in. */
  clocked(rule: DeadlineRule, at: number): HostResult;
  /** A new match at seq 0 with no clock and a fresh id, not put in. */
  plain(): HostResult;
  /** A fresh match id that nothing stores. */
  unknownId(): string;
  /** Puts in a game at seq 0, as a new match is stored outside `commit`. */
  putIn(write: MatchWrite): Promise<void>;
};

// Far from the other stack tests' times, so their matches are never due in these checks.
const T = 7_000_000_000_000;

/** `record` with its clock's deadlines (and the grace used) changed, as a grace extension changes them. */
function withDeadlines(record: MatchRecord, lio: number | null, sae: number | null, updatedAt: number): MatchRecord {
  return {
    ...record,
    updatedAt,
    clock: { ...record.clock!, deadlines: { lio, sae }, graceUsed: { lio: lio !== sae, sae: false } },
  };
}

/** Registers the DeadlineStore contract tests; call it inside a `describe`. */
export function deadlineStoreContract(setup: () => DeadlineStoreHarness, timeout?: number): void {
  /** A fresh harness and `due` kept to the given matches. */
  function fresh() {
    const h = setup();
    const ours = async (now: number, games: HostResult[]) => {
      const ids = new Set(games.map((g) => g.record.matchId));
      return (await h.store.due(now)).filter((id) => ids.has(id));
    };
    const stored = async (rule: DeadlineRule, at: number) => {
      const game = h.clocked(rule, at);
      await h.putIn(writeOf(game));
      return game;
    };
    return { h, s: h.store, ours, stored };
  }

  it(
    "due gives the matches whose earliest deadline is at or before now, by deadline, then by match id",
    async () => {
      const { ours, stored } = fresh();
      const first = await stored("lossOnTime", T - 5);
      const tiedA = await stored("lossOnTime", T);
      const tiedB = await stored("graceThenLoss", T);
      const notYet = await stored("lossOnTime", T + 1);
      const games = [notYet, tiedB, first, tiedA];
      const tied = [tiedA.record.matchId, tiedB.record.matchId].toSorted((a, b) => (a < b ? -1 : Number(a > b)));
      expect(await ours(T + DAY, games)).toEqual([first.record.matchId, ...tied]);
      expect(await ours(T + DAY - 6, games)).toEqual([]);
      expect(await ours(T + DAY - 5, games)).toEqual([first.record.matchId]);
    },
    timeout,
  );

  it(
    "due leaves out a match with no clock and a match that is over",
    async () => {
      const { h, s, ours, stored } = fresh();
      const plain = h.plain();
      await h.putIn(writeOf(plain));
      const start = await stored("lossOnTime", T + 1_000);
      expect(await ours(T + 10 * DAY, [plain, start])).toEqual([start.record.matchId]);
      // The record that ends the match still carries deadlines, so only its status can leave it out.
      const resigned = answered(start, h.players[0], { resign: true }, T + 1_001);
      expect(resigned.record.status.kind).not.toBe("active");
      const over = { ...resigned, record: withDeadlines(resigned.record, T + 1_000 + DAY, T + 1_000 + DAY, T + 1_001) };
      expect(await s.commit(start.record.matchId, 0, writeOf(over))).toBe("saved");
      expect(await ours(T + 10 * DAY, [plain, start])).toEqual([]);
    },
    timeout,
  );

  it(
    "after a commit, due follows the new record's deadlines",
    async () => {
      const { h, s, ours, stored } = fresh();
      const start = await stored("lossOnTime", T + 2_000);
      const old = T + 2_000 + DAY;
      expect(await ours(old, [start])).toEqual([start.record.matchId]);
      // LIO answers; the committed record's deadlines are both moved four days on, so the old one must stop counting.
      const answer = answered(start, h.players[0], bodyFor(0, start.secret, "lio"), T + 2_001);
      const later = old + 4 * DAY;
      const next = { ...answer, record: withDeadlines(answer.record, later, later, T + 2_001) };
      expect(await s.commit(start.record.matchId, 0, writeOf(next))).toBe("saved");
      expect(await ours(old, [start])).toEqual([]);
      expect(await ours(later - 1, [start])).toEqual([]);
      expect(await ours(later, [start])).toEqual([start.record.matchId]);
    },
    timeout,
  );

  it(
    "saveClock at the stored seq saves the record, keeps the secret, and due follows the new deadlines",
    async () => {
      const { s, ours, stored } = fresh();
      const start = await stored("graceThenLoss", T + 3_000);
      const matchId = start.record.matchId;
      const extended = withDeadlines(start.record, T + 3_000 + 2 * DAY, T + 3_000 + 3 * DAY, T + 3_000 + DAY);
      expect(await s.saveClock(matchId, 0, extended)).toBe("saved");
      expect(await s.load(matchId)).toEqual({ record: extended, secret: start.secret });
      expect(await ours(T + 3_000 + 2 * DAY - 1, [start])).toEqual([]);
      expect(await ours(T + 3_000 + 2 * DAY, [start])).toEqual([matchId]);
    },
    timeout,
  );

  it(
    "saveClock does not move the seq, so the next answer still commits from it",
    async () => {
      const { h, s, stored } = fresh();
      const start = await stored("graceThenLoss", T + 4_000);
      const matchId = start.record.matchId;
      const extended = withDeadlines(start.record, T + 4_000 + 2 * DAY, T + 4_000 + DAY, T + 4_000 + DAY);
      expect(await s.saveClock(matchId, 0, extended)).toBe("saved");
      expect((await s.load(matchId))!.record.seq).toBe(0);
      const next = answered(start, h.players[0], bodyFor(0, start.secret, "lio"), T + 4_000 + DAY + 1);
      expect(await s.commit(matchId, 0, writeOf(next))).toBe("saved");
      expect((await s.load(matchId))!.record).toEqual(next.record);
    },
    timeout,
  );

  it(
    "saveClock with a seq the match is not at, or for an unknown match, gives conflict and changes nothing",
    async () => {
      const { h, s, ours, stored } = fresh();
      const start = await stored("graceThenLoss", T + 5_000);
      const matchId = start.record.matchId;
      const later = withDeadlines(start.record, T + 5_000 + 9 * DAY, T + 5_000 + 9 * DAY, T + 5_000 + 7);
      for (const wrong of [1, 5, -1]) expect(await s.saveClock(matchId, wrong, later)).toBe("conflict");
      expect(await s.load(matchId)).toEqual({ record: start.record, secret: start.secret });
      expect(await ours(T + 5_000 + DAY, [start])).toEqual([matchId]);

      const unknown = h.unknownId();
      expect(await s.saveClock(unknown, 0, { ...later, matchId: unknown })).toBe("conflict");
      expect(await s.load(unknown)).toBeNull();
    },
    timeout,
  );
}
