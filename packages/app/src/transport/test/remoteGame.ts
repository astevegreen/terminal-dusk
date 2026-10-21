// The remote transport tests' match: a small game on the fake Supabase, fake timers, and helpers to
// subscribe, wait and find the next legal move.
import { legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { AnswerValue, CardDef, CardId, Ruleset, Side } from "@terminal-dusk/engine";
import type { Frame, HostResult, MatchConfig, Submission } from "@terminal-dusk/host";
import type { MatchTransport } from "../matchTransport.ts";
import { createRemoteMatch } from "../remoteMatch.ts";
import { ANON_KEY, createFakeSupabase, URL_BASE } from "./fakeSupabase.ts";
import type { FakeSupabase } from "./fakeSupabase.ts";

export const POLL_MS = 2_000;

const side = (id: CardId): Side | "neutral" => (id.startsWith("l") ? "lio" : id.startsWith("s") ? "sae" : "neutral");
const card = (id: CardId): CardDef => ({
  id,
  era: id.startsWith("e") ? "late" : "test",
  ops: 1,
  affiliation: side(id),
  effect: [],
});
const LIO = ["l1", "l2", "l3", "l4"];
const SAE = ["s1", "s2", "s3", "s4"];
export const ruleset: Ruleset = {
  id: "remote-test-ruleset",
  cards: [...LIO, ...SAE, "n1", "n2", "z1", "z2", "z3", "e1", "e2"].map(card),
};
export const config: MatchConfig = {
  matchId: "match-1",
  players: { lio: "alice", sae: "bob" },
  setup: {
    hands: { lio: [...LIO, "n1"], sae: [...SAE, "n2"] },
    deck: ["z1", "z2", "z3"],
    turns: 2,
    playsPerTurn: 1,
    handSize: 2,
    eras: [{ era: "late", turn: 2, cards: ["e1", "e2"] }],
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  },
};

/** Each player's access token. Carol is signed in but plays in neither seat. */
export const TOKENS: Record<string, string> = { "token-alice": "alice", "token-bob": "bob", "token-carol": "carol" };
const TOKEN_OF: Record<string, string> = { alice: "token-alice", bob: "token-bob", carol: "token-carol" };

/** Timers that only run when a test fires them. */
export function fakeTimers() {
  const pending = new Map<number, { run: () => void; ms: number }>();
  let next = 1;
  return {
    setTimer: (run: () => void, ms: number): unknown => {
      pending.set(next, { run, ms });
      return next++;
    },
    clearTimer: (handle: unknown): void => {
      pending.delete(handle as number);
    },
    /** The delays of the timers now waiting. */
    waiting: (): number[] => [...pending.values()].map((p) => p.ms),
    /** Runs every waiting timer; returns how many ran. */
    fire: (): number => {
      const due = [...pending.values()];
      pending.clear();
      for (const p of due) p.run();
      return due.length;
    },
  };
}

/** Lets every pending promise chain finish. The fake never uses real timers, so one macrotask is enough. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export type Rig = {
  fake: FakeSupabase;
  timers: ReturnType<typeof fakeTimers>;
  transportAs: (p: string | null) => MatchTransport;
};

/** A fresh match on a fresh fake server, and a maker of transports for a player (null: signed out). */
export function rig(): Rig {
  const fake = createFakeSupabase(ruleset, config, "remote-seed-1", TOKENS);
  const timers = fakeTimers();
  const transportAs = (player: string | null): MatchTransport =>
    createRemoteMatch({
      url: URL_BASE,
      anonKey: ANON_KEY,
      matchId: config.matchId,
      playerId: player,
      accessToken: () => Promise.resolve(player === null ? null : (TOKEN_OF[player] ?? null)),
      pollMs: POLL_MS,
      fetch: fake.fetch,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
  return { fake, timers, transportAs };
}

/** Subscribes and records every frame delivered. */
export function watch(t: MatchTransport): { frames: Frame[]; stop: () => void } {
  const frames: Frame[] = [];
  const stop = t.subscribe((f) => frames.push(f));
  return { frames, stop };
}

const waitingSide = (h: HostResult): Side => SIDES.find((s) => pendingFor(h.secret.state, s) !== null)!;
const firstAnswer = (h: HostResult, s: Side): AnswerValue => legalAnswers(ruleset, h.secret.state, s)[0]!;

/** The side now waiting, its answer as the transport sends it, and the same answer as a host submission. */
export function nextMove(h: HostResult) {
  const s = waitingSide(h);
  const args = { decisionId: pendingFor(h.secret.state, s)!.id, expectedSeq: h.record.seq, value: firstAnswer(h, s) };
  const submission: Submission = { player: h.record.players[s], ...args };
  return { s, player: h.record.players[s], args, submission };
}
