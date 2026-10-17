// Test helpers: a started placeholder game, answers for it, and small programs for the stack.
import { apply } from "../apply.ts";
import { createGame } from "../createGame.ts";
import { legalAnswers } from "../decisions.ts";
import { startProgram } from "../stack.ts";
import type { Answer, CardDef, CardId, GameEvent, GameState, Ruleset, Setup, Side, Step } from "../types.ts";

type Played = { state: GameState; events: GameEvent[] };

/** A plain card for tests: era "test", `ops` ops (default 1), neutral, no effect. */
export const testCard = (id: CardId, ops = 1): CardDef => ({
  id,
  era: "test",
  ops,
  affiliation: "neutral",
  effect: [],
});

/** The test ruleset, holding exactly the cards `ids`. */
export const rulesetWith = (ids: readonly CardId[]): Ruleset => ({
  id: "test-ruleset",
  cards: ids.map((id) => testCard(id)),
});

/** The test ruleset: cards c1 to c6, the ones makeSetup uses. */
export const ruleset: Ruleset = rulesetWith(["c1", "c2", "c3", "c4", "c5", "c6"]);

export const makeSetup = (rounds = 2): Setup => ({
  seedHash: "abc123",
  hands: { lio: ["c1", "c2"], sae: ["c3"] },
  deck: ["c4", "c5", "c6"],
  rounds,
});

/** A new placeholder game: both sides' opening yes/no pair is open. */
export function startGame(rounds = 2): GameState {
  const r = createGame(ruleset, makeSetup(rounds), "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** A new placeholder game with the opening pair answered, so LIO's pass is the open decision. */
export const startAtPass = (rounds = 2): GameState => playAnswers(startGame(rounds), 2);

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

/** Plays `count` answers: each time, the first open decision gets its first legal answer (pass, or yes). */
export function playAnswers(state: GameState, count: number): GameState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const d = s.public.pending[0];
    if (!d) throw new Error("no decision pending");
    s = accepted(s, { decisionId: d.id, side: d.side, value: legalAnswers(ruleset, s, d.side)[0]! });
  }
  return s;
}

/** Starts `steps` as a program on a fresh placeholder game (or on `state`) and expects it to be accepted. */
export function startWith(steps: Step[], rs: Ruleset = ruleset, state: GameState = startGame()): Played {
  const r = startProgram(rs, state, steps);
  if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
  return r.value;
}

/** The yes/no answer to the first open yes/no decision (or to `side`'s), which a paused program waits on. */
export function yesNoAnswer(state: GameState, yes: boolean, side?: Side): Answer {
  const d = state.public.pending.find((x) => x.kind === "yesNo" && (side === undefined || x.side === side));
  if (!d) throw new Error(`no yesNo decision pending${side ? ` for ${side}` : ""}`);
  return { decisionId: d.id, side: d.side, value: { kind: "yesNo", yes } };
}

/** Answers the open yes/no decision (or `side`'s) and expects it to be accepted. */
export function answerYesNo(state: GameState, yes: boolean, rs: Ruleset = ruleset, side?: Side): Played {
  const r = apply(rs, state, yesNoAnswer(state, yes, side));
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value;
}

/** The marker events, as "label" or "label:value", in order. A both-sides value shows as JSON. */
export const markers = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => {
    if (e.kind !== "marker") return [];
    if (e.value === undefined) return [e.label];
    return [`${e.label}:${typeof e.value === "object" ? JSON.stringify(e.value) : String(e.value)}`];
  });

/** Short builders for test programs. */
export const marker = (label: string, v?: string): Step =>
  v === undefined ? { op: "marker", label } : { op: "marker", label, var: v };
export const choose = (bind: string, who: Side | "both" = "lio"): Step => ({
  op: "choose",
  who,
  decision: { kind: "yesNo" },
  bind,
});
export const ifYes = (v: string, then: Step[], otherwise?: Step[]): Step =>
  otherwise === undefined
    ? { op: "if", cond: { op: "yes", var: v }, then }
    : { op: "if", cond: { op: "yes", var: v }, then, else: otherwise };
/** An `if` on one side's half of a both-sides answer. */
export const ifSaid = (side: Side, v: string, then: Step[], otherwise?: Step[]): Step =>
  otherwise === undefined
    ? { op: "if", cond: { op: "yes", var: v, side }, then }
    : { op: "if", cond: { op: "yes", var: v, side }, then, else: otherwise };
export const forEach = (over: string[], bind: string, body: Step[]): Step => ({ op: "forEach", over, bind, do: body });
