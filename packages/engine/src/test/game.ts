// Test helpers: a started placeholder game, and answers for it.
import { apply } from "../apply.ts";
import { createGame } from "../createGame.ts";
import type { Answer, GameState, Ruleset, Setup, Side } from "../types.ts";

export const ruleset: Ruleset = { id: "test-ruleset" };

export const makeSetup = (rounds = 2): Setup => ({
  seedHash: "abc123",
  hands: { lio: ["c1", "c2"], sae: ["c3"] },
  deck: ["c4", "c5", "c6"],
  rounds,
});

export function startGame(rounds = 2): GameState {
  const r = createGame(ruleset, makeSetup(rounds), "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** The pass answer to the decision `side` has open. */
export function passFor(state: GameState, side: Side): Answer {
  const d = state.public.pending.find((x) => x.side === side);
  if (!d) throw new Error(`no decision pending for ${side}`);
  return { decisionId: d.id, side, value: { kind: "pass" } };
}

/** Applies an answer that the test expects to be accepted. */
export function accepted(state: GameState, answer: Answer): GameState {
  const r = apply(ruleset, state, answer);
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value.state;
}

/** Plays `count` pass answers, the pending side answering each time. */
export function playPasses(state: GameState, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const side = s.public.pending[0]?.side;
    if (!side) throw new Error("no decision pending");
    s = accepted(s, passFor(s, side));
  }
  return s;
}
