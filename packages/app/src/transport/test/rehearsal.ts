// The phase 4 rehearsal (O13; docs/architecture.md, "Revised build order", phase 4): one Easy-vs-Easy game
// played through two real remote transports, one per seat, against a server. After every step both clients'
// frames are checked against the server's, and every response a client was sent is checked for hidden data.
// The server is passed in: the local Supabase stack in the stack test, the fake Supabase in the unit tests.
import { createEasyPlayer } from "@terminal-dusk/ai";
import { pendingFor, SIDES, viewFor } from "@terminal-dusk/engine";
import type { Ruleset, Side } from "@terminal-dusk/engine";
import type { Frame, MatchSecret } from "@terminal-dusk/host";
import type { MatchTransport } from "../matchTransport.ts";
import type { FetchLike } from "../remoteHttp.ts";
import { leaksFor, withoutCards } from "./leaks.ts";

/** What the server holds after the latest step, read past the client read rules (the service role). */
export type ServerSnapshot = {
  secret: MatchSecret;
  /** Each side's stored frame, with the events of the latest step only. */
  frames: Record<Side, Frame>;
};

/** One match on one server, ready to be played. */
export type GameRig = {
  matchId: string;
  /** A remote transport for the player in `side`'s seat, sending every request through `fetch`. */
  transport(side: Side, fetch: FetchLike): MatchTransport;
  /** The fetch a client would use. */
  fetch: FetchLike;
  server(): Promise<ServerSnapshot>;
};

export type GameOptions = {
  ruleset: Ruleset;
  /** Each Easy player's seed. */
  aiSeeds: Record<Side, number>;
  /** How long to wait for a client to be shown a step, in milliseconds. */
  waitMs: number;
  /** A game still going after this many steps is stopped and reported. */
  maxSteps: number;
};

export type GameResult = {
  matchId: string;
  steps: number;
  finished: boolean;
  winner: Side | null;
  framesChecked: number;
  responsesChecked: number;
  /** Each problem names its seq and side, never a card or any other hidden value. */
  desyncs: string[];
  leaks: string[];
  refusals: string[];
};

/** One response a client was sent, with the seq the server was at when it arrived. */
type Response = { side: Side; url: string; text: string; atSeq: number };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** JSON with every object's keys sorted, so a database's key order never counts as a difference. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** A fetch that records the text of every reply and hands the transport the same reply. */
function recording(base: FetchLike, side: Side, log: Response[], atSeq: () => number): FetchLike {
  return async (url, init) => {
    const reply = await base(url, init);
    const real = reply as { text?: () => Promise<string> };
    let text: string | null;
    try {
      text = typeof real.text === "function" ? await real.text() : JSON.stringify(await reply.json());
    } catch {
      text = null;
    }
    log.push({ side, url, text: text ?? "", atSeq: atSeq() });
    return {
      ok: reply.ok,
      status: reply.status,
      json: () =>
        text === null || text === ""
          ? Promise.reject(new SyntaxError("no JSON body"))
          : Promise.resolve(JSON.parse(text)),
    };
  };
}

/** The parts of a frame that differ from `expected`, by name. */
function differences(actual: Frame, expected: Partial<Frame>): string[] {
  return (Object.keys(expected) as (keyof Frame)[]).filter(
    (key) => canonical(actual[key]) !== canonical(expected[key]),
  );
}

/** Checks one side's frame at one step against the stored frame and the frame built from the server's state. */
function checkFrame(frame: Frame, snap: ServerSnapshot, side: Side, seq: number): string[] {
  const state: MatchSecret["state"] = snap.secret.state;
  const built: Partial<Frame> = {
    matchId: snap.frames[side].matchId,
    seq: state.meta.seq,
    viewer: side,
    ruleset: state.meta.ruleset,
    view: viewFor(state, side),
    decision: pendingFor(state, side),
  };
  return [
    ...differences(frame, snap.frames[side]).map(
      (part) => `seq ${seq}, ${side}: ${part} does not match the stored frame`,
    ),
    ...differences(frame, built).map((part) => `seq ${seq}, ${side}: ${part} does not match the server's state`),
  ];
}

/** Waits until `side`'s latest frame has reached `seq`, or the time runs out. */
async function frameAt(latest: Partial<Record<Side, Frame>>, side: Side, seq: number, waitMs: number) {
  for (let waited = 0; ; waited += 5) {
    const frame = latest[side];
    if (frame && frame.seq >= seq) return frame;
    if (waited >= waitMs) return null;
    await sleep(5);
  }
}

/** The hidden data in one response: rows are checked against the state of their own seq. */
function leaksInResponse(response: Response, secrets: Map<number, MatchSecret>): string[] {
  const where = `${response.side}, ${new URL(response.url).pathname}`;
  const table = /\/rest\/v1\/(match_view|match_event)$/.exec(new URL(response.url).pathname)?.[1];
  const parsed: unknown = table && response.text !== "" ? JSON.parse(response.text) : null;
  const pieces: { seq: number; text: string; viewer?: unknown }[] = Array.isArray(parsed)
    ? parsed.map((row: { seq?: unknown; frame?: { viewer?: unknown } }) => ({
        seq: typeof row.seq === "number" ? row.seq : response.atSeq,
        text: JSON.stringify(row),
        viewer: row.frame?.viewer,
      }))
    : [{ seq: response.atSeq, text: response.text }];
  const found: string[] = [];
  for (const piece of pieces) {
    const secret = secrets.get(piece.seq);
    if (!secret) {
      found.push(`seq ${piece.seq}, ${where}: no server state to check it against`);
      continue;
    }
    if (piece.viewer !== undefined && piece.viewer !== response.side && piece.viewer !== "spectator") {
      found.push(`seq ${piece.seq}, ${where}: the rival's frame`);
    }
    for (const leak of leaksFor(piece.text, secret, response.side)) {
      found.push(`seq ${piece.seq}, ${where}: ${withoutCards(leak)}`);
    }
  }
  return found;
}

/** Plays one game to its end, both seats Easy AI, checking every step. */
export async function playRehearsalGame(rig: GameRig, options: GameOptions): Promise<GameResult> {
  const result: GameResult = {
    matchId: rig.matchId,
    steps: 0,
    finished: false,
    winner: null,
    framesChecked: 0,
    responsesChecked: 0,
    desyncs: [],
    leaks: [],
    refusals: [],
  };
  const responses: Response[] = [];
  const secrets = new Map<number, MatchSecret>();
  let seq = 0;
  const latest: Partial<Record<Side, Frame>> = {};
  const shown: Record<Side, number[]> = { lio: [], sae: [] };
  const players = {
    lio: createEasyPlayer(options.ruleset, "lio", options.aiSeeds.lio),
    sae: createEasyPlayer(options.ruleset, "sae", options.aiSeeds.sae),
  };
  const transports = {} as Record<Side, MatchTransport>;
  const stops: (() => void)[] = [];
  for (const side of SIDES) {
    transports[side] = rig.transport(
      side,
      recording(rig.fetch, side, responses, () => seq),
    );
    stops.push(
      transports[side].subscribe((frame) => {
        latest[side] = frame;
        shown[side].push(frame.seq);
      }),
    );
  }

  try {
    game: for (;;) {
      const snap = await rig.server();
      seq = snap.secret.state.meta.seq;
      secrets.set(seq, snap.secret);
      for (const side of SIDES) {
        const frame = await frameAt(latest, side, seq, options.waitMs);
        if (frame === null) {
          result.desyncs.push(`seq ${seq}, ${side}: the client was not shown this step`);
          break game;
        }
        result.framesChecked++;
        result.desyncs.push(...checkFrame(frame, snap, side, seq));
      }
      const status = snap.secret.state.public.status;
      if (status.kind === "over") {
        result.finished = true;
        result.winner = status.winner;
        break;
      }
      if (result.steps >= options.maxSteps) {
        result.refusals.push(`seq ${seq}: still going after ${options.maxSteps} steps`);
        break;
      }
      const side = SIDES.find((s) => latest[s]?.decision);
      const frame = side === undefined ? undefined : latest[side];
      if (side === undefined || !frame?.decision) {
        result.desyncs.push(`seq ${seq}: the game is going but neither client has a decision`);
        break;
      }
      const value = players[side](frame.view);
      if (value === null) {
        result.refusals.push(`seq ${seq}, ${side}: the Easy AI gave no answer`);
        break;
      }
      const sent = await transports[side].submit({ decisionId: frame.decision.id, expectedSeq: frame.seq, value });
      if (!sent.ok) {
        result.refusals.push(`seq ${seq}, ${side}: the answer was refused (${sent.error.code})`);
        break;
      }
      result.steps++;
    }
  } finally {
    for (const stop of stops) stop();
  }

  for (const side of SIDES) {
    const expected = [...secrets.keys()].sort((a, b) => a - b);
    if (canonical(shown[side]) !== canonical(expected)) {
      result.desyncs.push(`${side}: the client was shown seqs ${shown[side].join(",")}, not each step once`);
    }
  }
  for (const response of responses) {
    result.responsesChecked++;
    result.leaks.push(...leaksInResponse(response, secrets));
  }
  return result;
}
