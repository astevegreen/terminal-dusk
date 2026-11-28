// The rating's words (placeholders: the owner has not written them yet) and the result screen's rating change.
// Plain functions, tested as tables. No rating maths: the server's Finalize step works the numbers out; this
// only compares two stored rows.
import { isProvisional } from "@terminal-dusk/host";
import type { MatchRatingChange, PlayerRating, Record3 } from "./playerRating.ts";

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

/** True while the player has a row and has finished fewer ranked games than the host's provisional count. */
export const provisionalRow = (row: PlayerRating | null): boolean => row !== null && isProvisional(row.rankedGames);

/** What the result screen shows about the rating after a game. */
export type RatingChange = { kind: "none" } | { kind: "waiting" } | { kind: "changed"; after: number; change: number };

/**
 * The change recorded for this match: Finalize's `rating_change` row (`row`, null while it has not been written).
 * Nothing is guessed: no row is "waiting", and a game that is not ranked shows nothing.
 */
export function ratingChange(ranked: boolean, row: MatchRatingChange | null): RatingChange {
  if (!ranked) return { kind: "none" };
  if (row === null) return { kind: "waiting" };
  const now = Math.round(row.after);
  return { kind: "changed", after: now, change: now - Math.round(row.before) };
}

/** "1512, up 12", "1488, down 12" or "1500, unchanged". */
export function ratingChangeText(c: Extract<RatingChange, { kind: "changed" }>): string {
  if (c.change === 0) return `${c.after}, unchanged`;
  return `${c.after}, ${c.change > 0 ? "up" : "down"} ${Math.abs(c.change)}`;
}
