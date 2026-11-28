// A player's rating, for the profile and the result screen (docs/architecture.md, Decision 5: `rating` is readable
// by everyone). One `rating` row over Supabase's REST endpoint, and whether a match is ranked. A player with no row
// has not finished a ranked game: that is `null`, not an error. It never throws; a malformed row is `network`.
import { getTable, isObject, outcome, refuse } from "./lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "./lobbyHttp.ts";

/** The lobby's refusals, and `badId` for a player id that is not a UUID (refused before any request). */
export type RatingResult<T> = LobbyResult<T> | { ok: false; error: { code: "badId" } };
const BAD_ID = { ok: false, error: { code: "badId" } } as const;

/** A side's record: wins, losses and draws. */
export type Record3 = { wins: number; losses: number; draws: number };

/** One player's rating row as the screens use it. `rating` is the Glicko-2 number, unrounded. */
export type PlayerRating = { rating: number; rankedGames: number; lio: Record3; sae: Record3; updatedAt: number };

/** The only columns read: no deviation or volatility, the screens do not need them. */
export const RATING_COLUMNS =
  "rating,ranked_games,lio_wins,lio_losses,lio_draws,sae_wins,sae_losses,sae_draws,updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const count = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null);

function ratingRow(row: unknown): PlayerRating | null {
  if (!isObject(row)) return null;
  const { rating, updated_at } = row;
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  const n = [
    row.ranked_games,
    row.lio_wins,
    row.lio_losses,
    row.lio_draws,
    row.sae_wins,
    row.sae_losses,
    row.sae_draws,
    updated_at,
  ].map(count);
  if (n.includes(null)) return null;
  const [rankedGames, lw, ll, ld, sw, sl, sd, updatedAt] = n as number[];
  return {
    rating,
    rankedGames: rankedGames!,
    lio: { wins: lw!, losses: ll!, draws: ld! },
    sae: { wins: sw!, losses: sl!, draws: sd! },
    updatedAt: updatedAt!,
  };
}

/** `playerId`'s rating row, or null when they have none yet (unrated). */
export async function playerRating(
  e: LobbyEndpoint,
  token: string | null,
  playerId: string,
): Promise<RatingResult<PlayerRating | null>> {
  if (token === null) return refuse("notSignedIn");
  // The id goes into the filter, so anything but a UUID is refused before a request.
  if (typeof playerId !== "string" || !UUID.test(playerId)) return BAD_ID;
  const reply = await getTable(e, token, "rating", [`select=${RATING_COLUMNS}`, `player=eq.${playerId}`]);
  // `outcome` treats null as a malformed reply, so the row travels in a box and "no row" is a box with null.
  const boxed = outcome(reply, (body): { row: PlayerRating | null } | null => {
    if (!Array.isArray(body) || body.length > 1) return null;
    if (body.length === 0) return { row: null };
    const row = ratingRow(body[0]);
    return row === null ? null : { row };
  });
  return boxed.ok ? { ok: true, value: boxed.value.row } : boxed;
}

/** True when the match is ranked, false when it is not; read from the player's own `match` row. */
export async function matchRanked(
  e: LobbyEndpoint,
  token: string | null,
  matchId: string,
): Promise<LobbyResult<boolean>> {
  if (token === null) return refuse("notSignedIn");
  const reply = await getTable(e, token, "match", ["select=ranked", `match_id=eq.${encodeURIComponent(matchId)}`]);
  return outcome(reply, (body) => {
    if (!Array.isArray(body) || body.length !== 1) return null;
    const row: unknown = body[0];
    return isObject(row) && typeof row.ranked === "boolean" ? row.ranked : null;
  });
}

/** One player's rating before and after one match, from its `rating_change` row (written by Finalize, #734). */
export type MatchRatingChange = { before: number; after: number; rankedGames: number };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `playerId`'s `rating_change` row for `matchId`, or null while Finalize has not written it (not an error). */
export async function matchRatingChange(
  e: LobbyEndpoint,
  token: string | null,
  matchId: string,
  playerId: string,
): Promise<RatingResult<MatchRatingChange | null>> {
  if (token === null) return refuse("notSignedIn");
  if (typeof playerId !== "string" || !UUID.test(playerId)) return BAD_ID;
  const reply = await getTable(e, token, "rating_change", [
    "select=rating_before,rating_after,ranked_games",
    `match_id=eq.${encodeURIComponent(matchId)}`,
    `player=eq.${playerId}`,
  ]);
  const boxed = outcome(reply, (body): { row: MatchRatingChange | null } | null => {
    if (!Array.isArray(body) || body.length > 1) return null;
    if (body.length === 0) return { row: null };
    const r: unknown = body[0];
    if (!isObject(r)) return null;
    const games = count(r.ranked_games);
    if (!finite(r.rating_before) || !finite(r.rating_after) || games === null) return null;
    return { row: { before: r.rating_before, after: r.rating_after, rankedGames: games } };
  });
  return boxed.ok ? { ok: true, value: boxed.value.row } : boxed;
}
