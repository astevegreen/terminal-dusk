// Finalize's rating step (docs/architecture.md, Decision 5, "Scheduled jobs", Finalize; #679). Every accepted step
// is saved through `commitStep`: an ordinary step is a plain commit; the step that finishes a ranked game also
// carries both players' new ratings, saved in the same commit, so the finish and the ratings land together or not
// at all. Repeating a finish changes nothing: its seq has moved on, so the second commit is a `conflict`.
import type { MatchRecord } from "@terminal-dusk/host";
import { isRatedFinish, ratingWrites } from "./ratings.ts";
import type { CommitResult, MatchStore, MatchWrite, SaveResult } from "./store.ts";

/** How many times a finish re-reads the ratings when another finish rated one of its players first. */
export const RATING_TRIES = 3;

/** Thrown when the ratings could not be worked out or kept moving; callers turn it into `storageFailed`. */
export class RatingError extends Error {
  constructor(matchId: string, reason: string) {
    super(`Ratings for match ${matchId} were not saved: ${reason}.`);
    this.name = "RatingError";
  }
}

/**
 * Saves `write`, the step after `before`, where the stored seq is still `before.seq`. When the step finishes a
 * rated game (ratings.ts, `isRatedFinish`) it reads both players' ratings, works out their new rows and saves
 * them with the step. Its answer is `saved` or `conflict`; it throws when the store throws, or when the ratings
 * moved on `RATING_TRIES` times running, so a finish is never saved without its ratings.
 */
export async function commitStep(
  store: MatchStore,
  before: MatchRecord,
  write: MatchWrite,
  now: number,
): Promise<SaveResult> {
  const { matchId } = before;
  if (!isRatedFinish(before, write.record)) return plain(await store.commit(matchId, before.seq, write), matchId);
  const { players } = write.record;
  for (let tries = 0; tries < RATING_TRIES; tries++) {
    const ratings = ratingWrites(write.record, await store.ratings([players.lio, players.sae]), now);
    if (ratings === null) throw new RatingError(matchId, "a stored rating is out of range");
    const result = await store.commit(matchId, before.seq, { ...write, ratings });
    if (result !== "ratingsMoved") return result;
  }
  throw new RatingError(matchId, "other finishes kept changing the players' ratings");
}

/** A commit without ratings never answers `ratingsMoved`; if a store did, nothing was saved, so it is a failure. */
const plain = (result: CommitResult, matchId: string): SaveResult => {
  if (result === "ratingsMoved") throw new RatingError(matchId, "the store refused a step without ratings");
  return result;
};
