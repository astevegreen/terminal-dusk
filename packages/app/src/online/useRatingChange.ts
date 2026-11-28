// The result screen's rating change: reads whether the match is ranked and the player's rating row when the screen
// opens, and the row again when the game is over, then compares the two (ratingText.ts, `ratingChange`). Any read
// that fails leaves "none" for an unranked or unreadable game, and "waiting" when only the second read failed:
// the screen never guesses a number.
import { useEffect, useState } from "react";
import type { LobbyEndpoint } from "./lobbyHttp.ts";
import { matchRanked, playerRating } from "./playerRating.ts";
import type { PlayerRating } from "./playerRating.ts";
import { ratingChange } from "./ratingText.ts";
import type { RatingChange } from "./ratingText.ts";

export type RatingSource = {
  endpoint: LobbyEndpoint;
  token: () => Promise<string | null>;
  playerId: string;
  matchId: string;
};

type Before = { ranked: boolean; row: PlayerRating | null } | null;

async function readBefore(s: RatingSource): Promise<Before> {
  const ranked = await matchRanked(s.endpoint, await s.token(), s.matchId);
  if (!ranked.ok) return null;
  if (!ranked.value) return { ranked: false, row: null };
  const row = await playerRating(s.endpoint, await s.token(), s.playerId);
  return row.ok ? { ranked: true, row: row.value } : null;
}

/** The change to show: "none" until the game is over, and for any game that is not ranked. */
export function useRatingChange(source: RatingSource | null, over: boolean): RatingChange {
  const [before, setBefore] = useState<Before>(null);
  const [change, setChange] = useState<RatingChange>({ kind: "none" });
  useEffect(() => {
    if (source === null) return;
    let live = true;
    void readBefore(source).then((b) => {
      if (live) setBefore(b);
    });
    return () => {
      live = false;
    };
  }, [source]);
  useEffect(() => {
    if (source === null || !over || before === null || !before.ranked) return;
    let live = true;
    void source
      .token()
      .then((token) => playerRating(source.endpoint, token, source.playerId))
      .then((after) => {
        if (live) setChange(ratingChange(true, before.row, after.ok ? after.value : before.row));
      });
    return () => {
      live = false;
    };
  }, [source, over, before]);
  return change;
}
