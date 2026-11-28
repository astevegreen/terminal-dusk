// Which steps are rated, and the rows a rated finish gives (#679).
import { hostSubmit, START_RATING, updateRating } from "@terminal-dusk/host";
import type { MatchRecord } from "@terminal-dusk/host";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { isRatedFinish, RANKED_RULESETS, ratingWrites } from "./ratings.ts";
import type { RatingRow } from "./ratings.ts";
import { NOW } from "./test/match.ts";
import { officialRuleset, PLAYERS, rankedMatch } from "./test/ranked.ts";

/** A ranked match, and the record once LIO (alice) resigns it. */
function finished(): { before: MatchRecord; after: MatchRecord } {
  const match = rankedMatch();
  const over = hostSubmit(officialRuleset, match.record, match.secret, { player: PLAYERS.lio, resign: true }, NOW + 1);
  if (!over.ok) throw new Error(over.error.code);
  return { before: match.record, after: over.value.record };
}

const overWith = (after: MatchRecord, winner: "lio" | "sae" | null): MatchRecord => ({
  ...after,
  status: { kind: "over", winner, reason: "resignation" } as MatchRecord["status"],
});

describe("isRatedFinish: only the finish of a ranked game on an official ruleset is rated", () => {
  it("the official rulesets are the first deck's", () => {
    expect(RANKED_RULESETS).toEqual([firstDeckRuleset.id]);
  });

  it("a ranked game going from active to over is rated", () => {
    const { before, after } = finished();
    expect(isRatedFinish(before, after)).toBe(true);
  });

  it("a game that is not ranked, a modded ruleset, or a player against themself is not", () => {
    const { before, after } = finished();
    const unranked = { ...after };
    delete unranked.ranked;
    expect(isRatedFinish(before, unranked)).toBe(false);
    expect(isRatedFinish(before, { ...after, ruleset: "modded-ruleset" })).toBe(false);
    expect(isRatedFinish(before, { ...after, players: { lio: "alice", sae: "alice" } })).toBe(false);
  });

  it("a step while the game goes on, or after it ended, is not", () => {
    const { before, after } = finished();
    expect(isRatedFinish(before, before)).toBe(false);
    expect(isRatedFinish(after, after)).toBe(false);
  });
});

describe("ratingWrites: both players' new rows", () => {
  it("each side is rated against the other's rating from before, and the rows come ordered by player id", () => {
    const { after } = finished();
    const bob: RatingRow = {
      player: "bob",
      rating: 1800,
      deviation: 100,
      volatility: 0.05,
      ranked_games: 12,
      lio_wins: 3,
      lio_losses: 2,
      lio_draws: 1,
      sae_wins: 4,
      sae_losses: 1,
      sae_draws: 1,
      updated_at: 5,
    };
    const writes = ratingWrites(overWith(after, "sae"), [bob], NOW)!;
    expect(writes.map((w) => [w.row.player, w.expected])).toEqual([
      ["alice", 0],
      ["bob", 12],
    ]);
    const old = { rating: 1800, deviation: 100, volatility: 0.05 };
    expect(writes[0]!.row).toMatchObject(updateRating(START_RATING, [{ opponent: old, score: "loss" }])!);
    expect(writes[1]!.row).toMatchObject(updateRating(old, [{ opponent: START_RATING, score: "win" }])!);
    expect(writes[1]!.row).toMatchObject({ ranked_games: 13, sae_wins: 5, lio_wins: 3, updated_at: NOW });
    expect(writes[0]!.row).toMatchObject({ ranked_games: 1, lio_losses: 1, sae_wins: 0, updated_at: NOW });
  });

  it("each write carries a change: the rating before and after, the count after, the match and the time", () => {
    const { after } = finished();
    for (const { row, change } of ratingWrites(after, [], NOW)!) {
      expect(change).toEqual({
        match_id: after.matchId,
        player: row.player,
        rating_before: START_RATING.rating,
        rating_after: row.rating,
        ranked_games: 1,
        created_at: NOW,
      });
    }
  });

  it("no winner is a draw for each side", () => {
    const { after } = finished();
    const [alice, bob] = ratingWrites(overWith(after, null), [], NOW)!;
    expect(alice!.row).toMatchObject({ lio_draws: 1, ranked_games: 1, lio_wins: 0, lio_losses: 0 });
    expect(bob!.row).toMatchObject({ sae_draws: 1, ranked_games: 1, sae_wins: 0, sae_losses: 0 });
  });

  it("gives null when a stored rating is out of range, so nothing is saved", () => {
    const { after } = finished();
    const broken = { ...ratingWrites(after, [], NOW)![0]!.row, deviation: -1 };
    expect(ratingWrites(after, [broken], NOW)).toBeNull();
  });

  it("a row holds only ratings and result counts: nothing from the game", () => {
    const { after } = finished();
    for (const { row } of ratingWrites(after, [], NOW)!) {
      expect(Object.keys(row).sort()).toEqual([
        "deviation",
        "lio_draws",
        "lio_losses",
        "lio_wins",
        "player",
        "ranked_games",
        "rating",
        "sae_draws",
        "sae_losses",
        "sae_wins",
        "updated_at",
        "volatility",
      ]);
    }
  });
});
