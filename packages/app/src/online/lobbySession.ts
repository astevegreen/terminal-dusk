// The state behind the online lobby (docs/architecture.md, Decision 5), built on the lobby client's calls
// (lobby.ts, myGames.ts): the New game choices, the invite code just created, joining by code (with the side
// question when the invite lets the joiner pick) and the player's games. The screen only draws its snapshot and
// calls its methods. The token is fetched for each call and never kept in the snapshot.
import type { Side } from "@terminal-dusk/engine";
import type { DeadlineRule, MatchDeadline, Platform } from "@terminal-dusk/host";
import { createGame, joinGame, previewInvite } from "./lobby.ts";
import type { Joined, SideMode } from "./lobby.ts";
import type { LobbyEndpoint, LobbyRefusal, LobbyResult } from "./lobbyHttp.ts";
import { myGames } from "./myGames.ts";
import type { MyGame } from "./myGames.ts";

export type LobbySnapshot = {
  /** The New game choices. */
  sides: SideMode;
  deadline: MatchDeadline;
  /** New game: `code` is the invite code just created. */
  create: { busy: boolean; code: string | null; refusal: LobbyRefusal | null };
  /** Join a game: `askSide` is the previewed code while the player is asked LIO or SAE. */
  join: { busy: boolean; askSide: string | null; joined: Joined | null; refusal: LobbyRefusal | null };
  /** My games: `list` is null until read, and after a failed read. */
  games: { busy: boolean; list: MyGame[] | null; refusal: LobbyRefusal | null };
};

export type LobbyOptions = {
  endpoint: LobbyEndpoint;
  /** The signed-in player's id. */
  playerId: string;
  accessToken: () => Promise<string | null>;
  /** The platform the game is created on; made in main.tsx. */
  platform: Platform;
  /** Puts text on the clipboard; made in main.tsx. */
  copy: (text: string) => Promise<void> | void;
};

export type LobbySession = {
  getSnapshot(): LobbySnapshot;
  subscribe(listener: () => void): () => void;
  /** Reads My games the first time; does nothing afterwards. */
  start(): Promise<void>;
  chooseSides(sides: SideMode): void;
  chooseDays(days: MatchDeadline["days"]): void;
  chooseRule(rule: DeadlineRule): void;
  /** Creates a private game with the current choices. */
  create(): Promise<void>;
  /** Copies the invite code just created; does nothing when there is none. */
  copyCode(): Promise<void>;
  /** Previews `code`, then joins it or asks for a side. */
  join(code: string): Promise<void>;
  /** Joins the previewed code with `side`; does nothing unless the side question is shown. */
  pickSide(side: Side): Promise<void>;
  /** The code field changed: the side question is dropped. */
  codeChanged(): void;
  /** Reads My games again. */
  refresh(): Promise<void>;
};

/** The defaults the New game part starts on. */
export const DEFAULT_SIDES: SideMode = { mode: "random" };
export const DEFAULT_DEADLINE: MatchDeadline = { rule: "graceThenLoss", days: 3 };

const normalCode = (code: string): string => code.trim().toUpperCase();

export function createLobbySession(options: LobbyOptions): LobbySession {
  const { endpoint, playerId, platform } = options;
  const listeners = new Set<() => void>();
  let started = false;
  // Each My games read is numbered; only the newest one started may change the list.
  let reads = 0;
  let snapshot: LobbySnapshot = {
    sides: DEFAULT_SIDES,
    deadline: DEFAULT_DEADLINE,
    create: { busy: false, code: null, refusal: null },
    join: { busy: false, askSide: null, joined: null, refusal: null },
    games: { busy: false, list: null, refusal: null },
  };

  const publish = (change: Partial<LobbySnapshot>): void => {
    snapshot = { ...snapshot, ...change };
    for (const listener of [...listeners]) listener();
  };
  const setJoin = (change: Partial<LobbySnapshot["join"]>): void => publish({ join: { ...snapshot.join, ...change } });

  const token = async (): Promise<string | null> => {
    try {
      return await options.accessToken();
    } catch {
      return null;
    }
  };

  const readGames = async (): Promise<void> => {
    const id = ++reads;
    publish({ games: { ...snapshot.games, busy: true } });
    const result = await myGames(endpoint, await token(), playerId);
    if (id !== reads) return;
    publish({
      games: result.ok
        ? { busy: false, list: result.value, refusal: null }
        : { busy: false, list: null, refusal: result.error.code },
    });
  };

  const finishJoin = async (result: LobbyResult<Joined>): Promise<void> => {
    if (!result.ok) {
      setJoin({ busy: false, askSide: null, refusal: result.error.code });
      return;
    }
    setJoin({ busy: false, askSide: null, joined: result.value, refusal: null });
    await readGames();
  };

  const choosing = (): boolean => !snapshot.create.busy;

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
      await readGames();
    },

    chooseSides(sides) {
      if (choosing()) publish({ sides });
    },
    chooseDays(days) {
      if (choosing()) publish({ deadline: { ...snapshot.deadline, days } });
    },
    chooseRule(rule) {
      if (choosing()) publish({ deadline: { ...snapshot.deadline, rule } });
    },

    async create() {
      if (snapshot.create.busy) return;
      const { sides, deadline } = snapshot;
      publish({ create: { busy: true, code: null, refusal: null } });
      const result = await createGame(endpoint, await token(), { sides, deadline, platform });
      publish({
        create: result.ok
          ? { busy: false, code: result.value, refusal: null }
          : { busy: false, code: null, refusal: result.error.code },
      });
    },

    async copyCode() {
      const code = snapshot.create.code;
      if (code === null) return;
      try {
        await options.copy(code);
      } catch {
        // A refused clipboard leaves the code on screen to copy by hand.
      }
    },

    async join(code) {
      if (snapshot.join.busy) return;
      const normal = normalCode(code);
      setJoin({ busy: true, askSide: null, joined: null, refusal: null });
      const access = await token();
      const preview = await previewInvite(endpoint, access, normal);
      if (!preview.ok) {
        setJoin({ busy: false, refusal: preview.error.code });
        return;
      }
      if (preview.value.mode === "invitee") {
        setJoin({ busy: false, askSide: normal });
        return;
      }
      await finishJoin(await joinGame(endpoint, access, normal));
    },

    async pickSide(side) {
      const code = snapshot.join.askSide;
      if (code === null || snapshot.join.busy) return;
      setJoin({ busy: true, refusal: null });
      await finishJoin(await joinGame(endpoint, await token(), code, side));
    },

    codeChanged() {
      // While a join is in flight the field is disabled; its result decides what shows.
      if (snapshot.join.busy || snapshot.join.askSide === null) return;
      setJoin({ askSide: null });
    },

    refresh: readGames,
  };
}
