// A watched game: an online game session that is always a spectator. It never signs in and sends no token, so
// even a seated player who opens a watch link is read as `spectator` and gets only the public frame. The
// session's answer does nothing because a spectator frame never holds a decision.
import { createOnlineGame } from "../onlineGame.ts";
import type { OnlineGame, OnlineGameOptions } from "../onlineGame.ts";

export type WatchGameOptions = Omit<OnlineGameOptions, "playerId" | "accessToken">;

export function createWatchGame(options: Readonly<WatchGameOptions>): OnlineGame {
  return createOnlineGame({ ...options, playerId: null, accessToken: () => Promise.resolve(null) });
}
