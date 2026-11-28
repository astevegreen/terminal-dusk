// Ratings at a ranked game's finish (docs/architecture.md, Decision 5, Finalize; #679). Pure: given the step that
// ends a game and both players' rating rows before it, the two rows after it. The maths is the host's Glicko-2
// calculator (#678); this file only decides whether a step is rated and maps the result to win, draw or loss.
// The rows hold ratings and counts of results only: nothing from the game, so nothing hidden.
import type { RulesetId, Side } from "@terminal-dusk/engine";
import { START_RATING, updateRating } from "@terminal-dusk/host";
import type { Glicko2Rating, MatchRecord, PlayerId, RatedGame } from "@terminal-dusk/host";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";

/**
 * The official rulesets: only a game on one of these is rated. A modded ruleset has another id (the content hash
 * is part of the id, docs/architecture.md, Decision 4), so it is never in this list and its games are never rated.
 */
export const RANKED_RULESETS: readonly RulesetId[] = [firstDeckRuleset.id];

/** One row of the `rating` table: a player's Glicko-2 rating, their ranked games and their results by side. */
export type RatingRow = {
  player: PlayerId;
  rating: number;
  deviation: number;
  volatility: number;
  /** Finished ranked games. Apps show "provisional" for the first 10 (host `isProvisional`). */
  ranked_games: number;
  lio_wins: number;
  lio_losses: number;
  lio_draws: number;
  sae_wins: number;
  sae_losses: number;
  sae_draws: number;
  updated_at: number;
};

/** One row of the `rating_change` table: a player's rating before and after one ranked game (#734). */
export type RatingChange = {
  match_id: string;
  player: PlayerId;
  rating_before: number;
  rating_after: number;
  /** The player's ranked-game count after this game. */
  ranked_games: number;
  created_at: number;
};

/**
 * One player's new row, and how many ranked games their row counted when it was read (0: they had no row). The
 * commit writes the row only while the stored count is still `expected`, so two finishes cannot both use one read.
 */
export type RatingWrite = { expected: number; row: RatingRow; change: RatingChange };

const SIDES: readonly Side[] = ["lio", "sae"];
const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/**
 * True when this step finishes a ranked game: the match is ranked, its ruleset is an official one, the players
 * differ, and the status goes from active to over. Any other step (a game that is not ranked, a modded ruleset, a
 * step of a game still going, or one after it ended) is never rated.
 */
export function isRatedFinish(before: MatchRecord, after: MatchRecord): boolean {
  return (
    after.ranked === true &&
    RANKED_RULESETS.includes(after.ruleset) &&
    after.players.lio !== after.players.sae &&
    before.status.kind === "active" &&
    after.status.kind === "over"
  );
}

/** A side's result: the winner wins and the other side loses; no winner (a draw, or a draw on time) is a draw. */
const scoreOf = (after: MatchRecord, side: Side): RatedGame["score"] => {
  if (after.status.kind !== "over" || after.status.winner === null) return "draw";
  return after.status.winner === side ? "win" : "loss";
};

const ratingOf = (row: RatingRow | undefined): Glicko2Rating =>
  row ? { rating: row.rating, deviation: row.deviation, volatility: row.volatility } : { ...START_RATING };

/** A player's first row, before any game: the start rating and no results. */
const blankRow = (player: PlayerId): RatingRow => ({
  player,
  ...START_RATING,
  ranked_games: 0,
  lio_wins: 0,
  lio_losses: 0,
  lio_draws: 0,
  sae_wins: 0,
  sae_losses: 0,
  sae_draws: 0,
  updated_at: 0,
});

const RESULT_COLUMN = { win: "wins", loss: "losses", draw: "draws" } as const;

/** The result column a side's score adds one to. */
const columnFor = (side: Side, score: RatedGame["score"]): keyof RatingRow => `${side}_${RESULT_COLUMN[score]}`;

/** Orders player ids by their code units, the same on every machine and in every locale. */
export const byPlayerId = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

/**
 * Both players' new rows for a finish `isRatedFinish` accepts, ordered by player id (the order the commit locks
 * them in), from their rows before it (`before`; a player with no row starts at the start rating). Each rating is
 * updated against the other's rating from before the game. Null when the calculator refuses a stored rating.
 */
export function ratingWrites(after: MatchRecord, before: readonly RatingRow[], now: number): RatingWrite[] | null {
  const stored = (side: Side) => before.find((row) => row.player === after.players[side]);
  const writes: RatingWrite[] = [];
  for (const side of SIDES) {
    const mine = stored(side);
    const score = scoreOf(after, side);
    const rating = updateRating(ratingOf(mine), [{ opponent: ratingOf(stored(other(side))), score }]);
    if (rating === null) return null;
    const row: RatingRow = { ...(mine ?? blankRow(after.players[side])), ...rating, updated_at: now };
    row.ranked_games += 1;
    const column = columnFor(side, score);
    (row[column] as number) += 1;
    const change: RatingChange = {
      match_id: after.matchId,
      player: row.player,
      rating_before: ratingOf(mine).rating,
      rating_after: row.rating,
      ranked_games: row.ranked_games,
      created_at: now,
    };
    writes.push({ expected: mine?.ranked_games ?? 0, row, change });
  }
  return writes.toSorted((a, b) => byPlayerId(a.row.player, b.row.player));
}
