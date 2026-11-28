// The rating's words (placeholders: the owner has not written them yet) and the result screen's rating change.
// Plain functions, tested as tables. No rating maths: the server's Finalize step works the numbers out; this
// only compares two stored rows.
import type { PlayerRating, Record3 } from "./playerRating.ts";

/** A first ranked game counts as "provisional" until this many are finished (owner, 27 Nov 2026). */
export const PROVISIONAL_UNDER = 10;

/** The rating every player starts from (Glicko-2, owner-approved); a first-game change is measured from it. */
export const START_RATING = 1500;

export const RATING_WORDS = {
  unrated: "Unrated",
  provisional: "Provisional",
  notUpdated: "Your rating has not updated yet",
  loadFailed: "The rating could not be read",
} as const;

export const recordText = (r: Record3): string => `${r.wins} won, ${r.losses} lost, ${r.draws} drawn`;

/** The rating as a whole number, or "Unrated" for a player with no row. */
export const ratingText = (row: PlayerRating | null): string =>
  row === null ? RATING_WORDS.unrated : String(Math.round(row.rating));

/** True while the player has finished fewer than PROVISIONAL_UNDER ranked games (and has a row). */
export const isProvisional = (row: PlayerRating | null): boolean => row !== null && row.rankedGames < PROVISIONAL_UNDER;

/** What the result screen shows about the rating after a game. */
export type RatingChange = { kind: "none" } | { kind: "waiting" } | { kind: "changed"; after: number; change: number };

/**
 * The change from the row read before the game (`before`, null for no row) to the row read now (`after`). The
 * finish has run only when the ranked-game count went up; until then the row is the old one and nothing is guessed.
 */
export function ratingChange(ranked: boolean, before: PlayerRating | null, after: PlayerRating | null): RatingChange {
  if (!ranked) return { kind: "none" };
  const was = before?.rankedGames ?? 0;
  if (after === null || after.rankedGames <= was) return { kind: "waiting" };
  const from = before === null ? START_RATING : Math.round(before.rating);
  const now = Math.round(after.rating);
  return { kind: "changed", after: now, change: now - from };
}

/** "1512, up 12", "1488, down 12" or "1500, unchanged". */
export function ratingChangeText(c: Extract<RatingChange, { kind: "changed" }>): string {
  if (c.change === 0) return `${c.after}, unchanged`;
  return `${c.after}, ${c.change > 0 ? "up" : "down"} ${Math.abs(c.change)}`;
}
