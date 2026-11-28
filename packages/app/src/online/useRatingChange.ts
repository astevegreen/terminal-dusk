// The result screen's rating change. It asks once whether the match is ranked, then, when the game is over, reads
// this player's `rating_change` row for the match (written by Finalize, #734) and shows its before and after. The row
// belongs to the match, so it is right even when the game ended before the screen opened. While the row is not there
// yet the screen says so, and the read is tried again every `retryMs` (up to `tries` times) until it appears. A read
// that fails is tried again the same way, never turned into a guess. An unranked game shows nothing.
import { useEffect, useState } from "react";
import type { LobbyEndpoint } from "./lobbyHttp.ts";
import { matchRanked, matchRatingChange } from "./playerRating.ts";
import { ratingChange } from "./ratingText.ts";
import type { RatingChange } from "./ratingText.ts";

export type RatingSource = {
  endpoint: LobbyEndpoint;
  token: () => Promise<string | null>;
  playerId: string;
  matchId: string;
  /** Wait between reads while the row is not there yet; default 2000 ms. */
  retryMs?: number;
  /** How many reads in all; default 8. */
  tries?: number;
};

const RETRY_MS = 2000;
const TRIES = 8;

/** The change to show: "none" until the game is over, and for any game that is not ranked. */
export function useRatingChange(source: RatingSource | null, over: boolean): RatingChange {
  const [change, setChange] = useState<RatingChange>({ kind: "none" });
  useEffect(() => {
    if (source === null || !over) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = source.retryMs ?? RETRY_MS;
    const tries = source.tries ?? TRIES;
    const attempt = async (n: number, ranked: boolean | null): Promise<void> => {
      let known = ranked;
      if (known === null) {
        const r = await matchRanked(source.endpoint, await source.token(), source.matchId);
        if (!live) return;
        if (r.ok) known = r.value;
      }
      if (known === false) {
        setChange({ kind: "none" });
        return;
      }
      if (known === true) {
        const row = await matchRatingChange(source.endpoint, await source.token(), source.matchId, source.playerId);
        if (!live) return;
        if (row.ok && row.value !== null) {
          setChange(ratingChange(true, row.value));
          return;
        }
        setChange({ kind: "waiting" });
      }
      if (n + 1 < tries) timer = setTimeout(() => void attempt(n + 1, known), wait);
    };
    void attempt(0, null);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [source, over]);
  return change;
}
