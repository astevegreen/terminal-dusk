// A lobby session wired to the fake lobby server, for the tests. Every request is answered by what the test
// queued with `fake.answerNext`; nothing queued answers 500 (so `network`).
import type { MyGame } from "../myGames.ts";
import { createLobbySession } from "../lobbySession.ts";
import type { LobbySession, LobbySnapshot } from "../lobbySession.ts";
import { OTHER, PLAYER, TOKEN, createFakeLobby } from "./fakeLobby.ts";
import type { FakeLobby } from "./fakeLobby.ts";

export type LobbyRig = {
  fake: FakeLobby;
  lobby: LobbySession;
  /** Every text the injected copy function was given. */
  copied: string[];
  /** Every snapshot the session published, in order, starting with the first one. */
  seen: LobbySnapshot[];
  /** Changes what accessToken gives, as `lobbyRig`'s `token` does, once `after` more calls have had the old one. */
  setToken: (token: string | null | Error, after?: number) => void;
};

/** `token` is what every accessToken call gives; an Error makes each call reject with it, as a refresh that fails
 * for a moment does once the old token has expired. */
export function lobbyRig(token: string | null | Error = TOKEN): LobbyRig {
  const fake = createFakeLobby();
  const copied: string[] = [];
  let current = token;
  let next: { token: string | null | Error; after: number } | null = null;
  const tokenNow = (): string | null | Error => {
    if (next === null) return current;
    if (next.after > 0) next.after -= 1;
    else {
      current = next.token;
      next = null;
    }
    return current;
  };
  const lobby = createLobbySession({
    endpoint: fake.endpoint,
    playerId: PLAYER,
    accessToken: () => {
      const t = tokenNow();
      return t instanceof Error ? Promise.reject(t) : Promise.resolve(t);
    },
    platform: "web",
    copy: (text) => {
      copied.push(text);
      return Promise.resolve();
    },
  });
  const seen: LobbySnapshot[] = [lobby.getSnapshot()];
  lobby.subscribe(() => seen.push(lobby.getSnapshot()));
  const setToken = (t: string | null | Error, after = 0): void => {
    next = { token: t, after };
  };
  return { fake, lobby, copied, seen, setToken };
}

/** A `match` row as the REST endpoint returns it. */
export const matchRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  match_id: "m-1",
  lio_player: PLAYER,
  sae_player: OTHER,
  status: { kind: "active" },
  updated_at: 100,
  ...over,
});

/** A lobby that has started and read an empty My games list. */
export async function startedRig(rows: unknown[] = []): Promise<LobbyRig> {
  const r = lobbyRig();
  r.fake.answerNext({ status: 200, body: rows });
  await r.lobby.start();
  return r;
}

export const game = (over: Partial<MyGame> = {}): MyGame => ({
  matchId: "m-1",
  mySide: "lio",
  status: { kind: "active" },
  updatedAt: 100,
  ...over,
});
