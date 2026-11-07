// The online game tests' rig: the remote transport's fake Supabase and fake timers (transport/test), with a
// small wrapper over the fake's fetch that answers the `select=clock` read of the match row, which the fake
// itself does not serve. Tests set the clock, make the read fail or reply badly, or hold it.
import type { MatchClock } from "@terminal-dusk/host";
import type { FetchLike, FetchReply } from "../../transport/remoteHttp.ts";
import { ANON_KEY, URL_BASE } from "../../transport/test/fakeSupabase.ts";
import { config, nextMove, POLL_MS, rig as transportRig, settle } from "../../transport/test/remoteGame.ts";
import { createOnlineGame } from "../onlineGame.ts";
import type { OnlineGame } from "../onlineGame.ts";
import { cardName } from "../../testMode/fixture.ts";

export const NOW = 50_000;
/** Carol is signed in but plays in neither seat, so she watches as a spectator. */
const TOKEN_OF: Record<string, string> = { alice: "token-alice", bob: "token-bob", carol: "token-carol" };

/** What the next clock reads get: the clock (or null for none), a failure, or a reply that is not a row list. */
export type ClockMode = { clock: MatchClock | null } | { fail: "throw" | number } | { malformed: unknown };

const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(JSON.parse(JSON.stringify(body)) as unknown),
});

export const isClockRead = (url: string): boolean => {
  const u = new URL(url);
  return u.pathname === "/rest/v1/match" && u.searchParams.get("select") === "clock";
};

/** `defaultPoll` leaves `pollMs` out, so the session's own default is used. */
export function onlineRig(player: string | null = "alice", initial: ClockMode = { clock: null }, defaultPoll = false) {
  const base = transportRig();
  const { fake, timers } = base;
  let mode: ClockMode = initial;
  let gate: Promise<void> | null = null;
  const clockUrls: string[] = [];
  /** Every request the session made, clock reads included, in order. */
  const sent: string[] = [];

  // With holdEachClock, each clock read keeps the mode it was sent under and waits for its own release.
  let holdEach = false;
  const heldReads: (() => void)[] = [];

  const fetch: FetchLike = async (url, init) => {
    sent.push(url);
    if (!isClockRead(url)) return fake.fetch(url, init);
    clockUrls.push(url);
    const sentUnder = mode;
    if (holdEach) await new Promise<void>((resolve) => heldReads.push(resolve));
    else if (gate !== null) await gate;
    const answer = holdEach ? sentUnder : mode;
    if ("fail" in answer) {
      if (answer.fail === "throw") throw new TypeError("fake network failure");
      return reply(answer.fail, { message: "fake error status" });
    }
    if ("malformed" in answer) return reply(200, answer.malformed);
    return reply(200, [{ clock: answer.clock }]);
  };

  const time = { now: NOW };
  const game: OnlineGame = createOnlineGame({
    url: URL_BASE,
    anonKey: ANON_KEY,
    matchId: config.matchId,
    playerId: player,
    accessToken: () => Promise.resolve(player === null ? null : (TOKEN_OF[player] ?? null)),
    fetch,
    now: () => time.now,
    label: cardName,
    ...(defaultPoll ? {} : { pollMs: POLL_MS }),
    timers,
  });

  return {
    fake,
    timers,
    /** A plain remote transport for a player on the same fake, to watch what the session should have seen. */
    transportAs: base.transportAs,
    game,
    time,
    clockUrls,
    sent,
    setClock(next: ClockMode) {
      mode = next;
    },
    /**
     * Holds each clock read from now on separately, answered with the clock set when it was sent. `release(i)` lets
     * the i-th held read (0 is the first) reply, so tests can release reads out of order.
     */
    holdEachClock(): { release(i: number): void } {
      holdEach = true;
      return { release: (i) => heldReads[i]?.() };
    },
    /** Holds every clock read until the returned function is called. */
    holdClock(): () => void {
      let release = (): void => undefined;
      gate = new Promise<void>((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return release;
    },
  };
}

type Rig = ReturnType<typeof onlineRig>;

/** Fires the waiting poll timer and lets everything it started finish. */
export async function poll(r: Rig): Promise<void> {
  r.timers.fire();
  await settle();
}

/** Commits the next legal move on the server, as the waiting player's own client would, then polls. */
export async function play(r: Rig): Promise<void> {
  r.fake.commit(nextMove(r.fake.current()).submission);
  await poll(r);
}

/** A clock with these deadlines. */
export const clockWith = (
  deadlines: MatchClock["deadlines"],
  rule: MatchClock["rule"] = "graceThenLoss",
  graceUsed: MatchClock["graceUsed"] = { lio: false, sae: false },
): MatchClock => ({ rule, days: 3, deadlines, graceUsed });
