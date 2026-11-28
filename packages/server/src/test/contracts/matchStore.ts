// The MatchStore contract: what both MemoryStore and SupabaseStore must do, checked only through the port, so
// one suite runs against the fake (stores.contract.test.ts) and the real tables (stores.contract.stack.test.ts).
import type { RatingChange } from "../../ratings.ts";
import type { HostResult } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import type { MatchStore, MatchWrite } from "../../store.ts";
import { bodyFor, nextSide } from "../match.ts";
import { answered } from "../stackGame.ts";
import { writeOf } from "../stack.ts";
import { matchStoreRatingContract } from "./matchStoreRatings.ts";

/** What one contract test works with; `setup` gives a fresh one at the start of each test. */
export type MatchStoreHarness = {
  store: MatchStore;
  /** A new game at seq 0 with a fresh id, not put in. */
  fresh(): HostResult;
  /** Puts in a game at seq 0, as a new match is stored outside `commit`. */
  putIn(write: MatchWrite): Promise<void>;
  /** Removes these players' rating rows, after a rating test. */
  forgetRatings(players: readonly string[]): Promise<void>;
  /** The saved rating changes of a match, ordered by player id; the harness also removes them after the test. */
  changesOf(matchId: string): Promise<RatingChange[]>;
};

/** The host's result for the next answer to `start`. */
const step = (start: HostResult): HostResult => {
  const side = nextSide(start.secret);
  return answered(start, start.record.players[side], bodyFor(start.record.seq, start.secret, side));
};

/** A game put in at seq 0, and the write of its next step. */
async function stored(h: MatchStoreHarness) {
  const start = h.fresh();
  await h.putIn(writeOf(start));
  const next = step(start);
  return { start, matchId: start.record.matchId, next: writeOf(next), after: next };
}

/** Registers the MatchStore contract tests; call it inside a `describe`. */
export function matchStoreContract(setup: () => MatchStoreHarness, timeout?: number): void {
  it(
    "load gives null for a match that does not exist",
    async () => {
      const h = setup();
      expect(await h.store.load(h.fresh().record.matchId)).toBeNull();
    },
    timeout,
  );

  it(
    "a match put in at seq 0 loads as its record and secret",
    async () => {
      const h = setup();
      const { start, matchId } = await stored(h);
      expect(await h.store.load(matchId)).toEqual({ record: start.record, secret: start.secret });
    },
    timeout,
  );

  it(
    "commit at the stored seq saves the write, and load gives back its record and secret",
    async () => {
      const h = setup();
      const { matchId, next } = await stored(h);
      expect(await h.store.commit(matchId, 0, next)).toBe("saved");
      expect(await h.store.load(matchId)).toEqual({ record: next.record, secret: next.secret });
    },
    timeout,
  );

  it(
    "commit with a seq the match is not at reports a conflict and saves nothing",
    async () => {
      const h = setup();
      const { start, matchId, next } = await stored(h);
      expect(await h.store.commit(matchId, 3, next)).toBe("conflict");
      expect(await h.store.load(matchId)).toEqual({ record: start.record, secret: start.secret });
    },
    timeout,
  );

  it(
    "of two commits from the same seq, the second reports a conflict and the first stays",
    async () => {
      const h = setup();
      const { matchId, next, after } = await stored(h);
      expect(await h.store.commit(matchId, 0, next)).toBe("saved");
      expect(await h.store.commit(matchId, 0, next)).toBe("conflict");
      expect(await h.store.commit(matchId, 1, writeOf(step(after)))).toBe("saved");
      expect((await h.store.load(matchId))!.record.seq).toBe(2);
    },
    timeout,
  );

  it(
    "commit for a match that does not exist reports a conflict and stores nothing",
    async () => {
      const h = setup();
      const start = h.fresh();
      expect(await h.store.commit(start.record.matchId, 0, writeOf(step(start)))).toBe("conflict");
      expect(await h.store.load(start.record.matchId)).toBeNull();
    },
    timeout,
  );

  it(
    "changing what load gave back does not change what is stored",
    async () => {
      const h = setup();
      const { start, matchId } = await stored(h);
      const loaded = (await h.store.load(matchId))!;
      loaded.record.players.lio = "mallory";
      loaded.secret.seed = "changed";
      expect(await h.store.load(matchId)).toEqual({ record: start.record, secret: start.secret });
    },
    timeout,
  );

  matchStoreRatingContract(setup, timeout);
}
