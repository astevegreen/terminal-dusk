// The rating part of the MatchStore contract (#679): a commit carrying ratings writes them with the step, only while
// each player's stored ranked-game count is still the write's `expected`, and otherwise saves nothing at all.
import type { HostResult } from "@terminal-dusk/host";
import { freshId } from "../../migrations/localStack.ts";
import { expect, it } from "vitest";
import type { RatingRow, RatingWrite } from "../../ratings.ts";
import type { MatchWrite } from "../../store.ts";
import { bodyFor, nextSide } from "../match.ts";
import { writeOf } from "../stack.ts";
import { answered } from "../stackGame.ts";
import type { MatchStoreHarness } from "./matchStore.ts";

/** A row for `player` after `games` ranked games, all won as LIO. */
const rowOf = (player: string, games: number, rating = 1500): RatingRow => ({
  player,
  rating,
  deviation: 200,
  volatility: 0.06,
  ranked_games: games,
  lio_wins: games,
  lio_losses: 0,
  lio_draws: 0,
  sae_wins: 0,
  sae_losses: 0,
  sae_draws: 0,
  updated_at: 1_000 + games,
});

const step = (start: HostResult): HostResult => {
  const side = nextSide(start.secret);
  return answered(start, start.record.players[side], bodyFor(start.record.seq, start.secret, side));
};

/** Registers the rating contract tests; `matchStoreContract` calls it. */
export function matchStoreRatingContract(setup: () => MatchStoreHarness, timeout?: number): void {
  /** A game put in at seq 0, the write of its next step, and two players no rating row knows yet. */
  async function stored(h: MatchStoreHarness) {
    const start = h.fresh();
    await h.putIn(writeOf(start));
    const players = [freshId(), freshId()].sort() as [string, string];
    return { start, matchId: start.record.matchId, next: writeOf(step(start)), players };
  }

  const withRatings = (write: MatchWrite, ratings: RatingWrite[]): MatchWrite => ({ ...write, ratings });

  /** Runs `body`, then removes the players' rating rows whatever happened. */
  async function rated(h: MatchStoreHarness, body: (s: Awaited<ReturnType<typeof stored>>) => Promise<void>) {
    const s = await stored(h);
    try {
      await body(s);
    } finally {
      await h.forgetRatings(s.players);
    }
  }

  it(
    "ratings gives nothing for players with no row",
    async () => {
      const h = setup();
      await rated(h, async ({ players }) => {
        expect(await h.store.ratings(players)).toEqual([]);
      });
    },
    timeout,
  );

  it(
    "a commit with first rows (expected 0) saves the step and the rows, and ratings reads them back",
    async () => {
      const h = setup();
      await rated(h, async ({ matchId, next, players: [a, b] }) => {
        const rows = [rowOf(a, 1, 1662.5), rowOf(b, 1, 1337.5)];
        const write = withRatings(
          next,
          rows.map((row) => ({ expected: 0, row })),
        );
        expect(await h.store.commit(matchId, 0, write)).toBe("saved");
        expect((await h.store.load(matchId))!.record.seq).toBe(1);
        const read = await h.store.ratings([a, b]);
        expect([...read].sort((x, y) => (x.player < y.player ? -1 : 1))).toEqual(rows);
      });
    },
    timeout,
  );

  it(
    "a commit updates a stored row when its count is still expected",
    async () => {
      const h = setup();
      await rated(h, async ({ start, matchId, next, players: [a, b] }) => {
        const first = withRatings(next, [{ expected: 0, row: rowOf(a, 1) }]);
        expect(await h.store.commit(matchId, 0, first)).toBe("saved");
        const later = withRatings(writeOf(step(step(start))), [
          { expected: 1, row: rowOf(a, 2, 1600) },
          { expected: 0, row: rowOf(b, 1) },
        ]);
        expect(await h.store.commit(matchId, 1, later)).toBe("saved");
        expect(await h.store.ratings([a])).toEqual([rowOf(a, 2, 1600)]);
      });
    },
    timeout,
  );

  it(
    "a wrong expected count answers ratingsMoved, and neither the step nor any rating is saved",
    async () => {
      const h = setup();
      await rated(h, async ({ start, matchId, next, players: [a, b] }) => {
        const first = withRatings(next, [{ expected: 0, row: rowOf(a, 1) }]);
        expect(await h.store.commit(matchId, 0, first)).toBe("saved");
        const after = writeOf(step(step(start)));
        // b's row is fine, a's says 0 games but a has 1: the whole step is refused, b's row too.
        const moved = withRatings(after, [
          { expected: 0, row: rowOf(a, 1, 1700) },
          { expected: 0, row: rowOf(b, 1) },
        ]);
        expect(await h.store.commit(matchId, 1, moved)).toBe("ratingsMoved");
        expect((await h.store.load(matchId))!.record.seq).toBe(1);
        expect(await h.store.ratings([a, b])).toEqual([rowOf(a, 1)]);
        const stale = withRatings(after, [{ expected: 5, row: rowOf(a, 6) }]);
        expect(await h.store.commit(matchId, 1, stale)).toBe("ratingsMoved");
        expect(await h.store.ratings([a])).toEqual([rowOf(a, 1)]);
      });
    },
    timeout,
  );

  it(
    "a commit at the wrong seq saves no ratings",
    async () => {
      const h = setup();
      await rated(h, async ({ matchId, next, players: [a] }) => {
        const write = withRatings(next, [{ expected: 0, row: rowOf(a, 1) }]);
        expect(await h.store.commit(matchId, 3, write)).toBe("conflict");
        expect(await h.store.ratings([a])).toEqual([]);
      });
    },
    timeout,
  );
}
