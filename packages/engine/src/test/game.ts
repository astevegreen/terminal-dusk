// Test helpers: a started game, answers for it, and small programs for the stack.
import { apply } from "../apply.ts";
import { createGame } from "../createGame.ts";
import { legalAnswers, pendingFor } from "../decisions.ts";
import { seedHash } from "../sha256.ts";
import { startProgram } from "../stack.ts";
import { SIDES } from "../types.ts";
import type { Answer, CardDef, CardId, GameEvent, GameState, PlayUse, Ruleset, Setup, Side, Step } from "../types.ts";

type Played = { state: GameState; events: GameEvent[] };

/** A card for tests: era "test", `ops` ops (default 1), neutral unless said, no effect unless given. */
export const testCard = (
  id: CardId,
  ops = 1,
  affiliation: Side | "neutral" = "neutral",
  effect: Step[] = [],
): CardDef => ({
  id,
  era: "test",
  ops,
  affiliation,
  effect,
});

/** LIO's cards l1 to l12, SAE's s1 to s12. */
const sideCards = (prefix: string): CardId[] => Array.from({ length: 12 }, (_, i) => `${prefix}${i + 1}`);
const LIO_CARDS = sideCards("l");
const SAE_CARDS = sideCards("s");

/**
 * The test ruleset, holding exactly the cards `ids`. A card whose id starts with "l" is LIO's, with "s"
 * SAE's; any other is neutral.
 */
export const rulesetWith = (ids: readonly CardId[]): Ruleset => ({
  id: "test-ruleset",
  cards: ids.map((id) => testCard(id, 1, affiliationOf(id))),
});
const affiliationOf = (id: CardId): Side | "neutral" => {
  if (id.startsWith("l")) return "lio";
  return id.startsWith("s") ? "sae" : "neutral";
};

/** The test ruleset: l1-l12, s1-s12, neutral n1 and n2, and neutral z1-z3 for the draw pile. */
export const ruleset: Ruleset = rulesetWith([...LIO_CARDS, ...SAE_CARDS, "n1", "n2", "z1", "z2", "z3"]);

/** A card for the test ruleset with its affiliation from its ID, as in rulesetWith. */
export const sideCard = (id: CardId, ops: number, effect: Step[] = []): CardDef =>
  testCard(id, ops, affiliationOf(id), effect);
/** The test ruleset with `cards` in place of the ones with the same IDs. */
export const withCards = (...cards: CardDef[]): Ruleset => ({
  ...ruleset,
  cards: ruleset.cards.map((c) => cards.find((o) => o.id === c.id) ?? c),
});

/**
 * A setup where each side is dealt its own cards for the whole game, turns x (1 + playsPerTurn), plus one
 * neutral card: LIO l1, l2, ... and n1; SAE s1, s2, ... and n2. The hand size is the smallest allowed,
 * 1 + playsPerTurn, so a hand never drops below it and the draw pile, z1-z3, is never drawn from (the
 * refill has its own tests in refill.test.ts). Each Contingency deck, the World deck too, is the default, 1 to 6.
 */
export const makeSetup = (turns = 2, playsPerTurn = 1, seed = "seed-1"): Setup => {
  const needed = turns * (1 + playsPerTurn);
  return {
    seedHash: seedHash(seed),
    hands: { lio: [...LIO_CARDS.slice(0, needed), "n1"], sae: [...SAE_CARDS.slice(0, needed), "n2"] },
    deck: ["z1", "z2", "z3"],
    turns,
    playsPerTurn,
    handSize: 1 + playsPerTurn,
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  };
};

/** makeSetup with `extra` cards added to each side's hand. */
export const setupPlus = (extra: { lio?: CardId[]; sae?: CardId[] }, turns = 2, playsPerTurn = 1): Setup => {
  const base = makeSetup(turns, playsPerTurn);
  return {
    ...base,
    hands: { lio: [...base.hands.lio, ...(extra.lio ?? [])], sae: [...base.hands.sae, ...(extra.sae ?? [])] },
  };
};

/** A new game: both sides' opening card pick is open. */
export function startGame(
  turns = 2,
  playsPerTurn = 1,
  rs: Ruleset = ruleset,
  setup = makeSetup(turns, playsPerTurn),
): GameState {
  const r = createGame(rs, setup, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** A new game with the opening cards picked (each side's first) and resolved, so LIO's play is open. */
export const startAtPlay = (turns = 2, playsPerTurn = 1): GameState => playAnswers(startGame(turns, playsPerTurn), 2);

/**
 * The answer naming `card` (default: the first legal one) to the card decision `side` has open. For a
 * play it is that card's first legal use: the event for your own card, else the points.
 */
export function cardAnswer(state: GameState, side: Side, card?: CardId, rs: Ruleset = ruleset): Answer {
  const d = pendingFor(state, side);
  if (!d) throw new Error(`no decision pending for ${side}`);
  if (d.kind !== "chooseCard" && d.kind !== "playCardAs") throw new Error(`${side}'s decision is ${d.kind}`);
  const legal = legalAnswers(rs, state, side);
  const value = legal.find((v) => "card" in v && (card === undefined || v.card === card));
  if (d.kind === "chooseCard") {
    const picked = card ?? (value && "card" in value ? value.card : undefined);
    if (picked === undefined) throw new Error(`${side} has no card to pick`);
    return { decisionId: d.id, side, value: { kind: "chooseCard", card: picked } };
  }
  if (!value) throw new Error(`${side} cannot play ${card ?? "any card"}`);
  return { decisionId: d.id, side, value };
}

/** The answer playing `card` for `as` (its event or its points) to the play `side` has open. */
export function playAnswer(state: GameState, side: Side, card: CardId, as: PlayUse): Answer {
  const d = pendingFor(state, side);
  if (d?.kind !== "playCardAs") throw new Error(`no play pending for ${side}`);
  return { decisionId: d.id, side, value: { kind: "playCardAs", card, as } };
}

/** The answer to `side`'s open rivalEventOrder: the rival's event happens before or after the points. */
export function orderAnswer(state: GameState, side: Side, event: "before" | "after"): Answer {
  const d = pendingFor(state, side);
  if (d?.kind !== "rivalEventOrder") throw new Error(`no rivalEventOrder pending for ${side}`);
  return { decisionId: d.id, side, value: { kind: "rivalEventOrder", event } };
}

/** Applies an answer that the test expects to be accepted, and returns the new state and its events. */
export function applied(state: GameState, answer: Answer, rs: Ruleset = ruleset): Played {
  const r = apply(rs, state, answer);
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value;
}

/** Applies an answer that the test expects to be accepted. */
export const accepted = (state: GameState, answer: Answer, rs: Ruleset = ruleset): GameState =>
  applied(state, answer, rs).state;

/** Both sides pick their opening card (LIO first), and the answer is expected to be accepted. */
export function openWith(state: GameState, lio: CardId, sae: CardId, rs: Ruleset = ruleset): Played {
  const half = accepted(state, cardAnswer(state, "lio", lio, rs), rs);
  const r = apply(rs, half, cardAnswer(half, "sae", sae, rs));
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value;
}

/** Plays `count` answers: each time, the first open decision gets its first legal answer. */
export function playAnswers(state: GameState, count: number, rs: Ruleset = ruleset): GameState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const d = s.public.pending[0];
    if (!d) throw new Error("no decision pending");
    s = accepted(s, { decisionId: d.id, side: d.side, value: legalAnswers(rs, s, d.side)[0]! }, rs);
  }
  return s;
}

/** Starts `steps` as a program at LIO's first play (or on `state`) and expects it to be accepted. */
export function startWith(steps: Step[], rs: Ruleset = ruleset, state: GameState = startAtPlay()): Played {
  const r = startProgram(rs, state, steps);
  if (!r.ok) throw new Error(`startProgram rejected: ${r.error.code}`);
  return r.value;
}

/** The yes/no answer to the first open yes/no decision (or to `side`'s), which a paused program waits on. */
export function yesNoAnswer(state: GameState, yes: boolean, side?: Side): Answer {
  const d = (side === undefined ? SIDES : [side]).map((s) => pendingFor(state, s)).find((x) => x?.kind === "yesNo");
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
/** An event that asks `who` yes or no, then shows the answer as a marker labelled `label`. */
export const asks = (who: Side, label: string): Step[] => [choose("a", who), marker(label, "a")];
export const forEach = (over: string[], bind: string, body: Step[]): Step => ({ op: "forEach", over, bind, do: body });
