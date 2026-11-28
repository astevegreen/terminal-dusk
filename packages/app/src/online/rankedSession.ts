// The state behind the "Find a ranked game" screen (docs/architecture.md, Decision 5, `seek`; #682), built on the
// search calls (ranked.ts) and My games (myGames.ts). The player picks a preset and a side, searches, and the
// screen shows "Searching" until the server's job pairs them. The ticket lives on the server, so the app may be
// closed: `start` finds a search left open and shows it again. `poll` (the screen calls it now and then while
// searching) notices that the ticket is gone, and then which game is new. The token is fetched for each call and
// never kept in the snapshot.
import type { Side } from "@terminal-dusk/engine";
import type { Platform } from "@terminal-dusk/host";
import { refuse } from "./lobbyHttp.ts";
import type { LobbyEndpoint, LobbyRefusal, LobbyResult } from "./lobbyHttp.ts";
import { myGames } from "./myGames.ts";
import type { MyGame } from "./myGames.ts";
import { cancelSearch, openSearches, startSearch } from "./ranked.ts";
import type { RankedPreset } from "./ranked.ts";

export type RankedSnapshot = {
  preset: RankedPreset;
  /** The side wanted, or null for no preference. */
  side: Side | null;
  /** `form`: choosing. `searching`: a ticket is open. `started`: the server made the game in `started`. */
  phase: "form" | "searching" | "started";
  /** A call is running. */
  busy: boolean;
  refusal: LobbyRefusal | null;
  started: MyGame | null;
};

export type RankedOptions = {
  endpoint: LobbyEndpoint;
  playerId: string;
  /** Null when signed out; rejects when the token can't be had for now, which is refused as `network`. */
  accessToken: () => Promise<string | null>;
  platform: Platform;
};

export type RankedSession = {
  getSnapshot(): RankedSnapshot;
  subscribe(listener: () => void): () => void;
  /** Shows a search left open by an earlier visit; does nothing afterwards. */
  start(): Promise<void>;
  choosePreset(preset: RankedPreset): void;
  chooseSide(side: Side | null): void;
  /** Starts the search with the current choices. */
  search(): Promise<void>;
  /** Ends the open search. */
  cancel(): Promise<void>;
  /** While searching: has the search ended, and with which game? */
  poll(): Promise<void>;
  /** After a game started: back to the form. */
  again(): void;
};

export const DEFAULT_PRESET: RankedPreset = "normal";

export function createRankedSession(options: RankedOptions): RankedSession {
  const { endpoint, playerId, platform } = options;
  const listeners = new Set<() => void>();
  let started = false;
  let ticketId: string | null = null;
  // The ids of the games the player had when the search began: the new one is the game that is not among them.
  let known = new Set<string>();
  let snapshot: RankedSnapshot = {
    preset: DEFAULT_PRESET,
    side: null,
    phase: "form",
    busy: false,
    refusal: null,
    started: null,
  };

  const publish = (change: Partial<RankedSnapshot>): void => {
    snapshot = { ...snapshot, ...change };
    for (const listener of [...listeners]) listener();
  };

  const withToken = async <T>(call: (token: string | null) => Promise<LobbyResult<T>>): Promise<LobbyResult<T>> => {
    let token: string | null;
    try {
      token = await options.accessToken();
    } catch {
      return refuse("network");
    }
    return call(token);
  };

  const readKnown = async (): Promise<LobbyRefusal | null> => {
    const games = await withToken((token) => myGames(endpoint, token, playerId));
    if (!games.ok) return games.error.code;
    known = new Set(games.value.map((g) => g.matchId));
    return null;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      if (started) return;
      started = true;
      publish({ busy: true });
      const open = await withToken((token) => openSearches(endpoint, token, playerId));
      const first = open.ok ? open.value[0] : undefined;
      if (first === undefined || (await readKnown()) !== null) {
        publish({ busy: false });
        return;
      }
      ticketId = first.id;
      publish({ busy: false, phase: "searching", preset: first.preset, side: first.side });
    },

    choosePreset(preset) {
      if (snapshot.phase === "form" && !snapshot.busy) publish({ preset, refusal: null });
    },
    chooseSide(side) {
      if (snapshot.phase === "form" && !snapshot.busy) publish({ side, refusal: null });
    },

    async search() {
      if (snapshot.phase !== "form" || snapshot.busy) return;
      const { preset, side } = snapshot;
      publish({ busy: true, refusal: null });
      const before = await readKnown();
      if (before !== null) {
        publish({ busy: false, refusal: before });
        return;
      }
      const made = await withToken((token) => startSearch(endpoint, token, { preset, side, platform }));
      if (!made.ok) {
        publish({ busy: false, refusal: made.error.code });
        return;
      }
      ticketId = made.value;
      publish({ busy: false, phase: "searching" });
    },

    async cancel() {
      const id = ticketId;
      if (snapshot.phase !== "searching" || id === null || snapshot.busy) return;
      publish({ busy: true, refusal: null });
      const result = await withToken((token) => cancelSearch(endpoint, token, id));
      // A ticket that is already gone was paired or cancelled: poll shows which.
      if (!result.ok && result.error.code !== "ticketNotFound") {
        publish({ busy: false, refusal: result.error.code });
        return;
      }
      ticketId = null;
      publish({ busy: false, phase: "form" });
      if (!result.ok) {
        // It was paired just before the cancel: the new game is shown instead.
        const games = await withToken((token) => myGames(endpoint, token, playerId));
        const fresh = games.ok ? games.value.find((g) => !known.has(g.matchId)) : undefined;
        if (fresh !== undefined) publish({ phase: "started", started: fresh });
      }
    },

    async poll() {
      const id = ticketId;
      if (snapshot.phase !== "searching" || id === null || snapshot.busy) return;
      const open = await withToken((token) => openSearches(endpoint, token, playerId));
      // A failed read changes nothing: the search goes on, and the next poll asks again.
      if (!open.ok || open.value.some((s) => s.id === id) || ticketId !== id) return;
      const games = await withToken((token) => myGames(endpoint, token, playerId));
      if (!games.ok || ticketId !== id) return;
      const fresh = games.value.find((g) => !known.has(g.matchId));
      ticketId = null;
      publish(fresh === undefined ? { phase: "form" } : { phase: "started", started: fresh });
    },

    again() {
      if (snapshot.phase === "started") publish({ phase: "form", started: null, refusal: null });
    },
  };
}
