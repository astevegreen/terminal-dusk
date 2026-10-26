// The signed-in player's games, for the lobby (docs/architecture.md, Decision 5): their `match` rows over
// Supabase's REST endpoint, never the `seed` column, newest first. It never throws; one malformed row
// fails the whole call as `network`, so the screen never shows half a list.
import type { GameStatus, Side } from "@terminal-dusk/engine";
import { getTable, isObject, outcome, refuse } from "./lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "./lobbyHttp.ts";

/** One of the player's games. `updatedAt` is the row's own time number. */
export type MyGame = { matchId: string; mySide: Side; status: GameStatus; updatedAt: number };

/** The only columns read: never `seed`. */
export const MY_GAMES_COLUMNS = "match_id,lio_player,sae_player,status,updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A fresh copy of a complete `GameStatus`, or null. */
function gameStatus(v: unknown): GameStatus | null {
  if (!isObject(v)) return null;
  if (v.kind === "active") return { kind: "active" };
  if (v.kind !== "over" || typeof v.reason !== "string") return null;
  if (v.winner !== "lio" && v.winner !== "sae" && v.winner !== null) return null;
  return { kind: "over", winner: v.winner, reason: v.reason };
}

function myGame(row: unknown, playerId: string): MyGame | null {
  if (!isObject(row)) return null;
  const { match_id, lio_player, sae_player, updated_at } = row;
  if (typeof match_id !== "string" || match_id === "") return null;
  if (typeof lio_player !== "string" || typeof sae_player !== "string") return null;
  if (typeof updated_at !== "number" || !Number.isSafeInteger(updated_at)) return null;
  const status = gameStatus(row.status);
  if (status === null) return null;
  let mySide: Side;
  if (lio_player === playerId) mySide = "lio";
  else if (sae_player === playerId) mySide = "sae";
  else return null;
  return { matchId: match_id, mySide, status, updatedAt: updated_at };
}

function games(body: unknown, playerId: string): MyGame[] | null {
  if (!Array.isArray(body)) return null;
  const list: MyGame[] = [];
  for (const row of body) {
    const game = myGame(row, playerId);
    if (game === null) return null;
    list.push(game);
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The games where `playerId` holds a seat, newest `updatedAt` first. */
export async function myGames(
  e: LobbyEndpoint,
  token: string | null,
  playerId: string,
): Promise<LobbyResult<MyGame[]>> {
  if (token === null) return refuse("notSignedIn");
  // The id goes into the filter, so anything but a UUID is refused before a request.
  if (typeof playerId !== "string" || !UUID.test(playerId)) return refuse("notSignedIn");
  const reply = await getTable(e, token, "match", [
    `select=${MY_GAMES_COLUMNS}`,
    `or=(lio_player.eq.${playerId},sae_player.eq.${playerId})`,
    "order=updated_at.desc",
  ]);
  return outcome(reply, (body) => games(body, playerId));
}
