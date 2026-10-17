// Test helpers: a started placeholder game, answers for it, and small programs for the stack.
import { apply } from "../apply.ts";
import { createGame } from "../createGame.ts";
import { startProgram } from "../stack.ts";
import type { Answer, GameEvent, GameState, Ruleset, Setup, Side, Step } from "../types.ts";

type Played = { state: GameState; events: GameEvent[] };

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

/** Starts `steps` as a program on a fresh placeholder game (or on `state`) and expects it to be accepted. */
export function startWith(steps: Step[], rs: Ruleset = ruleset, state: GameState = startGame()): Played {
  const r = startProgram(rs, state, steps);
  if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
  return r.value;
}

/** The yes/no answer to the decision that is open, which a paused program is waiting on. */
export function yesNoAnswer(state: GameState, yes: boolean): Answer {
  const d = state.public.pending.find((x) => x.kind === "yesNo");
  if (!d) throw new Error("no yesNo decision pending");
  return { decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } };
}

/** Answers the open yes/no decision and expects it to be accepted. */
export function answerYesNo(state: GameState, yes: boolean, rs: Ruleset = ruleset): Played {
  const r = apply(rs, state, yesNoAnswer(state, yes));
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value;
}

/** The marker events, as "label" or "label:value", in order. */
export const markers = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) =>
    e.kind !== "marker" ? [] : [e.value === undefined ? e.label : `${e.label}:${String(e.value)}`],
  );

/** Short builders for test programs. */
export const marker = (label: string, v?: string): Step =>
  v === undefined ? { op: "marker", label } : { op: "marker", label, var: v };
export const choose = (bind: string, who: Side = "lio"): Step => ({
  op: "choose",
  who,
  decision: { kind: "yesNo" },
  bind,
});
export const ifYes = (v: string, then: Step[], otherwise?: Step[]): Step =>
  otherwise === undefined
    ? { op: "if", cond: { op: "yes", var: v }, then }
    : { op: "if", cond: { op: "yes", var: v }, then, else: otherwise };
export const forEach = (over: string[], bind: string, body: Step[]): Step => ({ op: "forEach", over, bind, do: body });
