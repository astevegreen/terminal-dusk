// The phase 4 rehearsal's harness (O13), proved on the fake Supabase with the real first deck: a game plays to
// its end with every step checked, a frame that differs from the server's is reported as a desync, hidden data
// in a response is reported as a leak, and the report shows no seed or card.
import type { Side } from "@terminal-dusk/engine";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import type { FetchLike } from "./remoteHttp.ts";
import { createRemoteMatch } from "./remoteMatch.ts";
import { ANON_KEY, createFakeSupabase, URL_BASE } from "./test/fakeSupabase.ts";
import type { FakeSupabase } from "./test/fakeSupabase.ts";
import { canonical, leaksFor } from "./test/leaks.ts";
import { playRehearsalGame } from "./test/rehearsal.ts";
import type { GameOptions, GameResult, GameRig, ServerSnapshot } from "./test/rehearsal.ts";
import { rehearsalReport } from "./test/rehearsalReport.ts";

const MATCH_ID = "rehearsal-1";
const SEED = "rehearsal-seed-1";
const PLAYERS: Record<Side, string> = { lio: "alice", sae: "bob" };
const TOKENS: Record<string, string> = { "token-alice": "alice", "token-bob": "bob" };
const OPTIONS: GameOptions = { ruleset: firstDeckRuleset, aiSeeds: { lio: 1, sae: 2 }, waitMs: 5_000, maxSteps: 2_000 };

/** A first-deck match on a fresh fake Supabase. `tamper` may change what the server read gives back. */
function fakeRig(tamper?: (snap: ServerSnapshot) => ServerSnapshot): { fake: FakeSupabase; rig: GameRig } {
  const config = { ...firstDeckConfig(), matchId: MATCH_ID, players: PLAYERS };
  const fake = createFakeSupabase(firstDeckRuleset, config, SEED, TOKENS);
  const rig: GameRig = {
    matchId: MATCH_ID,
    fetch: fake.fetch,
    transport: (side, fetch) =>
      createRemoteMatch({
        url: URL_BASE,
        anonKey: ANON_KEY,
        matchId: MATCH_ID,
        playerId: PLAYERS[side],
        accessToken: () => Promise.resolve(`token-${PLAYERS[side]}`),
        pollMs: 1,
        fetch,
        setTimer: (run, ms) => setTimeout(run, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      }),
    server: () => {
      const { secret, frames } = fake.current();
      const snap = { secret, frames: { lio: frames.lio, sae: frames.sae } };
      return Promise.resolve(tamper ? tamper(snap) : snap);
    },
  };
  return { fake, rig };
}

type Row = Record<string, unknown>;

/** A fetch that changes every match_view row SAE is sent with `change`. */
function changeSaeFrames(fake: FakeSupabase, change: (row: Row) => Row): FetchLike {
  return async (url, init) => {
    const reply = await fake.fetch(url, init);
    if (!url.includes("/rest/v1/match_view") || init.headers.Authorization !== "Bearer token-bob") return reply;
    const changed = ((await reply.json()) as Row[]).map(change);
    return { ok: reply.ok, status: reply.status, json: () => Promise.resolve(changed) };
  };
}

describe("the phase 4 rehearsal harness on the fake Supabase", () => {
  it("an Easy-vs-Easy first-deck game plays to the end, every step's frames match the server's, and no response carries hidden data", async () => {
    const { rig } = fakeRig();
    const result = await playRehearsalGame(rig, OPTIONS);
    expect(result.desyncs).toEqual([]);
    expect(result.leaks).toEqual([]);
    expect(result.refusals).toEqual([]);
    expect(result.finished).toBe(true);
    expect(result.steps).toBeGreaterThan(2);
    // Both seats are checked at seq 0 and after every step.
    expect(result.framesChecked).toBe(2 * (result.steps + 1));
    expect(result.responsesChecked).toBeGreaterThan(result.steps);
  }, 60_000);

  it("the same seeds play the same game twice", async () => {
    const first = await playRehearsalGame(fakeRig().rig, OPTIONS);
    const second = await playRehearsalGame(fakeRig().rig, OPTIONS);
    expect(second.steps).toBe(first.steps);
    expect(second.winner).toBe(first.winner);
  }, 60_000);

  it("a client frame that differs from the server's stored frame is reported as a desync, by seq and side", async () => {
    const { rig } = fakeRig((snap) =>
      snap.secret.state.meta.seq === 1
        ? {
            ...snap,
            frames: { ...snap.frames, lio: { ...snap.frames.lio, view: { ...snap.frames.lio.view, mine: null } } },
          }
        : snap,
    );
    const result = await playRehearsalGame(rig, OPTIONS);
    expect(result.desyncs).toEqual(["seq 1, lio: view does not match the stored frame"]);
    expect(result.leaks).toEqual([]);
  }, 60_000);

  it("a frame from the server that differs from the server's own state is reported as a desync", async () => {
    // The stored frame and the client agree with each other, but neither matches the state: both are tampered.
    const { rig } = fakeRig((snap) => ({
      ...snap,
      secret: {
        ...snap.secret,
        state: { ...snap.secret.state, meta: { ...snap.secret.state.meta, ruleset: "other" } },
      },
    }));
    const result = await playRehearsalGame(rig, { ...OPTIONS, maxSteps: 1 });
    expect(result.desyncs).toContain("seq 0, lio: ruleset does not match the server's state");
    expect(result.desyncs).toContain("seq 0, sae: ruleset does not match the server's state");
  }, 60_000);

  it("a response carrying the rival's hand is reported as a leak, without naming the card", async () => {
    const { fake, rig } = fakeRig();
    const lioCard = (): unknown => fake.current().secret.state.private.lio.hand[0] ?? null;
    const leaky: GameRig = { ...rig, fetch: changeSaeFrames(fake, (row) => ({ ...row, extra: lioCard() })) };
    const result = await playRehearsalGame(leaky, { ...OPTIONS, maxSteps: 1 });
    expect(result.leaks.length).toBeGreaterThan(0);
    expect(result.leaks[0]).toMatch(/^seq \d+, sae, \/rest\/v1\/match_view: a hidden card$/);
    const card = JSON.stringify(fake.current().secret.state.private.lio.hand[0]);
    expect(result.leaks.join("\n")).not.toContain(card);
  }, 60_000);

  it("a response carrying the rival's frame is reported as a leak", async () => {
    const { fake, rig } = fakeRig();
    const leaky: GameRig = {
      ...rig,
      fetch: changeSaeFrames(fake, (row) => ({ ...row, frame: fake.current().frames.lio })),
    };
    const result = await playRehearsalGame(leaky, { ...OPTIONS, maxSteps: 1 });
    expect(result.leaks).toContain("seq 0, sae, /rest/v1/match_view: the rival's frame");
    expect(result.leaks.some((leak) => leak.endsWith("a hidden card"))).toBe(true);
    // SAE was shown LIO's frame, so it is a desync too.
    expect(result.desyncs.length).toBeGreaterThan(0);
  }, 60_000);

  it("a reply with a database's spacing and key order still has the rival's private compartment found in it", async () => {
    const { fake, rig } = fakeRig();
    const spaced: FetchLike = async (url, init) => {
      const reply = await fake.fetch(url, init);
      if (!url.includes("/rest/v1/match_view") || init.headers.Authorization !== "Bearer token-bob") return reply;
      const lio = fake.current().secret.state.private.lio;
      const rows = ((await reply.json()) as Row[]).map((row) => ({
        ...row,
        extra: Object.fromEntries(Object.entries(lio).reverse()),
      }));
      const text = JSON.stringify(rows, null, 1);
      return {
        ok: reply.ok,
        status: reply.status,
        json: () => Promise.resolve(rows),
        text: () => Promise.resolve(text),
      };
    };
    const result = await playRehearsalGame({ ...rig, fetch: spaced }, { ...OPTIONS, maxSteps: 1 });
    expect(result.leaks).toContain("seq 0, sae, /rest/v1/match_view: lio's private compartment");
  }, 60_000);
});

describe("the rehearsal's leak check on the rival's private fields", () => {
  /** The fake's secret at seq 0, with LIO's knowledge set to `knowledge` (cards of SAE's it was shown). */
  function secretWithKnowledge(fake: FakeSupabase, knowledge: (sae: string[]) => string[]) {
    const base = fake.current().secret;
    const { private: priv } = base.state;
    const lio = { ...priv.lio, knowledge: knowledge(priv.sae.hand) };
    return { ...base, state: { ...base.state, private: { ...priv, lio } } };
  }

  it("the rival's knowledge in a response is a leak, though the cards in it are the viewer's own", () => {
    const { fake } = fakeRig();
    const secret = secretWithKnowledge(fake, (hand) => hand.slice(0, 1));
    const text = canonical({ extra: { knowledge: secret.state.private.lio.knowledge } });
    expect(leaksFor(text, secret, "sae")).toEqual(["lio's knowledge"]);
  });

  it("the rival's whole private compartment in a response is a leak", () => {
    const { fake } = fakeRig();
    const secret = secretWithKnowledge(fake, (hand) => hand.slice(0, 1));
    expect(leaksFor(canonical({ extra: secret.state.private.lio }), secret, "sae")).toContain(
      "lio's private compartment",
    );
  });

  it("the viewer's own frame is no leak, even when the rival has been shown the viewer's whole hand", () => {
    const { fake } = fakeRig();
    const secret = secretWithKnowledge(fake, (hand) => [...hand]);
    expect(secret.state.private.lio.knowledge.length).toBeGreaterThan(0);
    expect(leaksFor(canonical(fake.current().frames.sae), secret, "sae")).toEqual([]);
  });
});

describe("the phase 4 rehearsal's report", () => {
  const game = (over: Partial<GameResult>): GameResult => ({
    matchId: "m-1",
    steps: 40,
    finished: true,
    winner: "lio",
    framesChecked: 82,
    responsesChecked: 300,
    desyncs: [],
    leaks: [],
    refusals: [],
    ...over,
  });

  it("counts the games, steps, frames and responses checked, and passes when nothing went wrong", () => {
    const report = rehearsalReport("Rehearsal", [game({}), game({ matchId: "m-2", steps: 60, winner: "sae" })]);
    expect(report).toContain("Games: 2 played, 2 finished (LIO won 1, SAE won 1, no winner 0)");
    expect(report).toContain("Steps: 100 (shortest game 40, longest 60)");
    expect(report).toContain("Frames checked against the server: 164");
    expect(report).toContain("Responses checked for hidden data: 600");
    expect(report).toContain("Desyncs: 0");
    expect(report).toContain("Leaks: 0");
    expect(report.endsWith("Result: PASS")).toBe(true);
  });

  it("lists every desync, leak and early stop with its match, and fails", () => {
    const report = rehearsalReport("Rehearsal", [
      game({ desyncs: ["seq 3, lio: view does not match the stored frame"] }),
      game({ matchId: "m-2", finished: false, leaks: ["seq 5, sae, /rest/v1/match_view: a hidden card"] }),
    ]);
    expect(report).toContain("Desyncs: 1\n  - m-1: seq 3, lio: view does not match the stored frame");
    expect(report).toContain("Leaks: 1\n  - m-2: seq 5, sae, /rest/v1/match_view: a hidden card");
    expect(report.endsWith("Result: FAIL")).toBe(true);
  });

  it("a real game's report shows neither the seed nor any card", async () => {
    const { fake, rig } = fakeRig();
    const report = rehearsalReport("Rehearsal", [await playRehearsalGame(rig, OPTIONS)]);
    expect(report).not.toContain(SEED);
    expect(report).not.toMatch(/e1-/);
    expect(fake.current().record.seq).toBeGreaterThan(0);
  }, 60_000);
});
