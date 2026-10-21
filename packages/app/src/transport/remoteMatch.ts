// The online transport (docs/architecture.md, Decisions 3 and 5): one caller's window onto one match on
// Supabase. It polls the caller's own frame and events from the client-readable rows, and posts answers to
// the submit function. Everything it talks to is passed in, so it holds no URL, key, token or platform code.
import type { Viewer } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { MatchTransport, SubmitResult, TransportError } from "./matchTransport.ts";
import { postSubmission, readEvents, readFrame, readSeats } from "./remoteHttp.ts";
import type { Endpoint, FetchLike, Seats } from "./remoteHttp.ts";

export type RemoteMatchOptions = {
  /** The Supabase project URL, with no trailing slash. */
  url: string;
  /** The project's public (anon) key. */
  anonKey: string;
  matchId: string;
  /** The signed-in player's id, or null when signed out. */
  playerId: string | null;
  /** The caller's access token, or null when signed out. */
  accessToken: () => Promise<string | null>;
  /** How long to wait between polls, in milliseconds. */
  pollMs: number;
  fetch: FetchLike;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

/** One subscriber and the seq of the last frame it was given (null before its first). */
type Subscriber = { onFrame: (frame: Frame) => void; last: number | null };

const refuse = (code: TransportError["code"], message: string): SubmitResult => ({
  ok: false,
  error: { code, message },
});
const NOT_SIGNED_IN = refuse("notSignedIn", "Sign in to play.");
const NOT_PLAYER = refuse("notPlayer", "Only the match's two players can answer.");
const NETWORK_ERROR = refuse("networkError", "The server could not be reached. Try again.");
const NO_MATCH = refuse("matchNotFound", "There is no match with that id.");

export function createRemoteMatch(options: RemoteMatchOptions): MatchTransport {
  const { playerId, accessToken, pollMs, setTimer, clearTimer } = options;
  const endpoint: Endpoint = {
    url: options.url,
    anonKey: options.anonKey,
    matchId: options.matchId,
    fetch: options.fetch,
  };
  const subscribers = new Set<Subscriber>();
  let timer: unknown = null;
  let polling = false;
  let pollAgain = false;
  // The match's players never change, so the first successful read is kept. A failed read is tried again later.
  let seats: Promise<Seats | null> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const token = async (): Promise<string | null> => (playerId === null ? null : await accessToken());

  const seatsFor = (t: string | null): Promise<Seats | null> => {
    seats ??= readSeats(endpoint, t).then(
      (found) => {
        if (found === null) seats = null;
        return found;
      },
      (error: unknown) => {
        seats = null;
        throw error;
      },
    );
    return seats;
  };

  const viewerOf = (s: Seats): Viewer => (playerId === s.lio ? "lio" : playerId === s.sae ? "sae" : "spectator");

  /** One poll: reads the latest frame and gives it, with the events each subscriber has not had, to each. */
  const pollOnce = async (): Promise<void> => {
    const t = await token();
    const found = await seatsFor(t);
    if (found === null) return;
    const viewer = viewerOf(found);
    const frame = await readFrame(endpoint, t, viewer);
    if (frame === null) return;
    const behind = [...subscribers].filter((s) => s.last === null || s.last < frame.seq);
    if (behind.length === 0) return;
    // Events are read only up to this frame's seq, so a step committed since is left for the next poll.
    const after = Math.min(...behind.map((s) => s.last ?? -1));
    const steps = await readEvents(endpoint, t, viewer, after, frame.seq);
    for (const s of behind) {
      if (!subscribers.has(s)) continue;
      const from = s.last ?? -1;
      s.last = frame.seq;
      s.onFrame({ ...frame, events: steps.filter((step) => step.seq > from).flatMap((step) => step.events) });
    }
  };

  /** Runs one poll, then schedules the next. Only one poll runs at a time; a failed poll delivers nothing. */
  const poll = async (): Promise<void> => {
    polling = true;
    pollAgain = false;
    try {
      await pollOnce();
    } catch {
      // A failed read gives nothing; the next poll tries again.
    }
    polling = false;
    if (subscribers.size === 0) return;
    if (pollAgain) {
      void poll();
      return;
    }
    timer = setTimer(() => {
      timer = null;
      void poll();
    }, pollMs);
  };

  const stopTimer = (): void => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };

  /** Checks the caller locally, then posts. Runs inside the queue, so one submission finishes before the next. */
  const sendNow = async (submission: unknown): Promise<SubmitResult> => {
    if (playerId === null) return NOT_SIGNED_IN;
    let t: string | null;
    let found: Seats | null;
    try {
      t = await accessToken();
      if (t === null) return NOT_SIGNED_IN;
      found = await seatsFor(t);
    } catch {
      return NETWORK_ERROR;
    }
    if (found === null) return NO_MATCH;
    if (playerId !== found.lio && playerId !== found.sae) return NOT_PLAYER;
    const reply = await postSubmission(endpoint, t, submission);
    if (reply.ok) return { ok: true };
    if ("network" in reply) return NETWORK_ERROR;
    // The server's code is passed on unchanged.
    const code = reply.code as TransportError["code"];
    return reply.message === undefined
      ? { ok: false, error: { code } }
      : { ok: false, error: { code, message: reply.message } };
  };

  const send = (submission: unknown): Promise<SubmitResult> => {
    const run = queue.then(() => sendNow(submission));
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    subscribe(onFrame) {
      const subscriber: Subscriber = { onFrame, last: null };
      subscribers.add(subscriber);
      // A new subscriber is read for at once: now if no poll is running, else straight after the running one.
      if (polling) pollAgain = true;
      else {
        stopTimer();
        void poll();
      }
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) stopTimer();
      };
    },
    submit(s) {
      return send({ decisionId: s.decisionId, expectedSeq: s.expectedSeq, value: s.value });
    },
    resign() {
      return send({ resign: true });
    },
  };
}
