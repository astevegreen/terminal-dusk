// The client side of one online game, with no screen (docs/architecture.md, Decision 5): runs the remote
// transport with real timers, keeps the latest frame and the game's log and era, says whose turn it is, reads
// the deadline from the match row's clock, and sends answers. It holds display data only: no rules, and the
// access token is only passed through, never kept in the snapshot.
import type { AnswerValue, CardId, EraId } from "@terminal-dusk/engine";
import type { Frame, MatchClock } from "@terminal-dusk/host";
import { eraText, mapNames } from "../displayText.ts";
import type { GameNames, MapNames } from "../displayText.ts";
import { logLine } from "../eventPresentation.ts";
import type { TransportError } from "../transport/matchTransport.ts";
import type { FetchLike } from "../transport/remoteHttp.ts";
import { createRemoteMatch } from "../transport/remoteMatch.ts";
import { deadlineFor, readClock } from "./matchClock.ts";
import type { OnlineDeadline } from "./matchClock.ts";
import { realTimers } from "./timers.ts";
import type { Timers } from "./timers.ts";

/** Whose move it is: the viewer's, the other side's, nobody's (the game is over), or not known yet. */
export type OnlineTurn = "mine" | "rival" | "over" | "loading";

export type OnlineGameSnapshot = {
  /** The latest frame, or null before the first. */
  frame: Frame | null;
  /** Every delivered event as a log line, oldest first. */
  log: string[];
  /** The era of the latest eraStarted event, or null if none yet. */
  era: EraId | null;
  turn: OnlineTurn;
  deadline: OnlineDeadline | null;
  /** Why the last answer was refused, or null. */
  refusal: TransportError | null;
};

export type OnlineGameOptions = {
  /** The Supabase project URL, with no trailing slash. */
  url: string;
  anonKey: string;
  matchId: string;
  /** The signed-in player's id, or null when signed out. */
  playerId: string | null;
  accessToken: () => Promise<string | null>;
  fetch: FetchLike;
  /** The time, in whole milliseconds, stamped on each deadline read. */
  now: () => number;
  /** How the log names cards: the game's own card names. */
  label: (id: CardId) => string;
  /** How long to wait between polls; 5000 when left out. */
  pollMs?: number;
  /** Real timers when left out. */
  timers?: Timers;
};

export type OnlineGame = {
  getSnapshot(): OnlineGameSnapshot;
  subscribe(listener: () => void): () => void;
  /** Answers the current decision; a refusal shows up in the snapshot. Does nothing with no decision. */
  answer(value: AnswerValue): Promise<void>;
  /** Stops polling. Nothing is sent afterwards, and work still in flight changes nothing. */
  close(): void;
};

export const DEFAULT_POLL_MS = 5_000;

/**
 * Whose turn `frame` shows. "rival" only when the public view's pending decisions hold one for a side other
 * than the viewer (for a spectator, any side). An active game with nothing pending for anyone else says
 * nothing about whose turn it is, so it stays "loading" rather than guessing.
 */
export function turnOf(frame: Frame | null): OnlineTurn {
  if (frame === null) return "loading";
  if (frame.view.public.status.kind === "over") return "over";
  if (frame.decision !== null) return "mine";
  if (frame.view.public.pending.some((d) => d.side !== frame.viewer)) return "rival";
  return "loading";
}

const CLOSED = new Error("online game closed");

export function createOnlineGame(options: OnlineGameOptions): OnlineGame {
  const { playerId, accessToken, now } = options;
  const timers = options.timers ?? realTimers;
  const names: Omit<GameNames, keyof MapNames> = { card: options.label, era: eraText };
  const listeners = new Set<() => void>();
  let closed = false;
  let lastSeq = -1;
  // Each clock read is numbered; only the newest one started may change the deadline.
  let clockReads = 0;
  let snapshot: OnlineGameSnapshot = {
    frame: null,
    log: [],
    era: null,
    turn: "loading",
    deadline: null,
    refusal: null,
  };

  const publish = (change: Partial<OnlineGameSnapshot>): void => {
    if (closed) return;
    snapshot = { ...snapshot, ...change };
    for (const listener of [...listeners]) listener();
  };

  // Every request goes through here, so once closed nothing more reaches the network.
  const fetch: FetchLike = (url, init) => (closed ? Promise.reject(CLOSED) : options.fetch(url, init));
  const endpoint = { url: options.url, anonKey: options.anonKey, matchId: options.matchId, fetch };

  const refreshDeadline = async (): Promise<void> => {
    const id = ++clockReads;
    let clock: MatchClock | null | undefined;
    try {
      const token = playerId === null ? null : await accessToken();
      clock = await readClock(endpoint, token);
    } catch {
      return;
    }
    const frame = snapshot.frame;
    if (closed || id !== clockReads || clock === undefined || frame === null) return;
    publish({ deadline: deadlineFor(clock, frame, now()) });
  };

  const onFrame = (frame: Frame): void => {
    if (closed) return;
    let { log, era } = snapshot;
    const isNew = frame.seq > lastSeq;
    if (isNew) {
      log = [...log, ...frame.events.map((event) => logLine(event, { ...names, ...mapNames(frame.view.public) }))];
      lastSeq = frame.seq;
      for (const event of frame.events) if (event.kind === "eraStarted") era = event.era;
    }
    publish({ frame, log, era, turn: turnOf(frame), refusal: null });
    if (isNew) void refreshDeadline();
  };

  const transport = createRemoteMatch({
    url: options.url,
    anonKey: options.anonKey,
    matchId: options.matchId,
    playerId,
    accessToken,
    pollMs: options.pollMs ?? DEFAULT_POLL_MS,
    fetch,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const unsubscribe = transport.subscribe(onFrame);

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async answer(value) {
      const { frame } = snapshot;
      const decision = frame?.decision;
      if (closed || !frame || !decision) return;
      // A new answer clears the last refusal, so a repeated refusal shows again rather than looking unchanged.
      if (snapshot.refusal !== null) publish({ refusal: null });
      const result = await transport.submit({ decisionId: decision.id, expectedSeq: frame.seq, value });
      if (!result.ok) publish({ refusal: result.error });
    },
    close() {
      if (closed) return;
      closed = true;
      unsubscribe();
      listeners.clear();
    },
  };
}
