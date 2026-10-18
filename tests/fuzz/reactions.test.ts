// Fuzz games on the test-only reaction cards (reactions.ts): triggers and modifiers that ask questions, make
// more modifiers and triggers, and draw contingencies from inside a reaction (#107). Also the step budget
// and the trigger bounds of #89 and #90, on small fixed games.
import { apply, createGame, legalAnswers, pendingFor, seedHash, SIDES } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Ruleset, Setup, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "./deepFreeze.ts";
import { gameCount, playGame } from "./play.ts";
import type { Chooser, GameRecord } from "./play.ts";
import { playReactionGame, reactionModifierCards, reactionsRuleset } from "./reactions.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

/** A quarter of FUZZ_GAMES (these games take longer to play), but at least this many, so the counts below cannot be zero by chance. */
const MIN_GAMES = 200;
const GAMES = Math.max(Math.floor(gameCount(process.env["FUZZ_GAMES"]) / 4), MIN_GAMES);

/** A game replayed answer by answer on `rules`: every event, and the states that paused for a question. */
function replay(rules: Ruleset, record: GameRecord): { events: GameEvent[]; reactionQuestions: number } {
  const events: GameEvent[] = [];
  let reactionQuestions = 0;
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  events.push(...created.value.events);
  for (const answer of record.answers) {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
    // A reaction's program has the hook's variables bound (card and player, or turn); a card's own program has none.
    const vars = state.public.stack.at(-1)?.vars ?? [];
    if (state.public.pending.length > 0 && vars.some((v) => v.name === "player" || v.name === "turn")) {
      reactionQuestions++;
    }
  }
  return { events, reactionQuestions };
}

describe("reaction fuzz games", () => {
  it(
    `plays ${GAMES} games on the reaction cards to the end, with every check at every step, and reactions fire, ask, and make modifiers`,
    () => {
      const reactionModifiers = new Set(reactionModifierCards(reactionsRuleset));
      let finished = 0;
      const counts = { cardPlayed: 0, turnEnd: 0, questions: 0, modifiers: 0 };
      for (let game = 1; game <= GAMES; game++) {
        // playReactionGame throws, with the game's record, when a check fails; it plays the same game again.
        const { record, final } = playReactionGame(game);
        if (final.public.status.kind === "over") finished++;
        const { events, reactionQuestions } = replay(reactionsRuleset, record);
        counts.questions += reactionQuestions;
        for (const e of events) {
          if (e.kind === "triggerFired") counts[e.hook]++;
          if (e.kind === "modifierStarted" && reactionModifiers.has(e.source)) counts.modifiers++;
        }
      }
      expect(finished).toBe(GAMES);
      expect(counts.cardPlayed).toBeGreaterThan(0);
      expect(counts.turnEnd).toBeGreaterThan(0);
      expect(counts.questions).toBeGreaterThan(0);
      expect(counts.modifiers).toBeGreaterThan(0);
    },
    Math.max(60_000, GAMES * 40),
  );
});

// ---- small fixed games on cards defined here ----

/** Cards c1 to c20 are LIO's and c21 to c40 SAE's: a hand needs sided cards for its opening picks. */
const LIO_CARDS = 20;
const card = (id: string, effect: Step[]): Ruleset["cards"][number] => ({
  id,
  era: "fuzz",
  ops: 1,
  affiliation: Number(id.slice(1)) <= LIO_CARDS ? "lio" : "sae",
  effect,
});
/** A ruleset of cards c1 to c40 that all have `effect`. */
function allCards(id: string, effect: Step[], stepBudget?: number): Ruleset {
  const cards = Array.from({ length: 2 * LIO_CARDS }, (_, i) => card(`c${i + 1}`, effect));
  return deepFreeze({ id, cards, ...(stepBudget === undefined ? {} : { limits: { stepBudget } }) });
}
const marker = (label: string, v?: string): Step => ({ op: "marker", label, ...(v === undefined ? {} : { var: v }) });
const hand = (from: number, n: number): string[] => Array.from({ length: n }, (_, i) => `c${from + i}`);
const setup = (turns: number, playsPerTurn: number): Setup => {
  const each = turns * (1 + playsPerTurn);
  return {
    seedHash: seedHash("reactions"),
    hands: { lio: hand(1, each), sae: hand(LIO_CARDS + 1, each) },
    deck: [],
    turns,
    playsPerTurn,
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
  };
};
/** Plays every card for its event, in hand order: the first legal answer, preferring an event play. */
function eventChooser(rules: Ruleset): Chooser {
  return (state) => {
    for (const side of SIDES) {
      const decision = pendingFor(state, side);
      const legal = legalAnswers(rules, state, side);
      if (decision === null || legal.length === 0) continue;
      const value = legal.find((a) => a.kind === "playCardAs" && a.as === "event") ?? legal[0]!;
      return { decisionId: decision.id, side: decision.side, value };
    }
    return null;
  };
}
const played = (rules: Ruleset, turns: number, playsPerTurn: number) =>
  playGame(rules, "reactions fixture", setup(turns, playsPerTurn), "reactions", eventChooser(rules));
const eventsOf = (rules: Ruleset, record: GameRecord): GameEvent[] => replay(rules, record).events;

describe("step budget", () => {
  // Every play sets a cardPlayed trigger that runs 5 markers, so each play fires one more of them than the last.
  const reaction: Step[] = [
    {
      op: "trigger",
      hook: "cardPlayed",
      do: Array.from({ length: 5 }, () => marker("r")),
      duration: { kind: "turnEnd" },
    },
  ];
  const tight = allCards("budget-tight", reaction, 12);
  const roomy = allCards("budget-roomy", reaction);

  it("the apply call that would run more steps than the budget returns stepBudgetExceeded and leaves its frozen input unchanged", () => {
    const { record } = played(roomy, 1, 5);
    const created = createGame(tight, record.setup, record.seed);
    if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
    let state: GameState = deepFreeze(created.value.state);
    let refusedAt = -1;
    for (const [i, answer] of record.answers.entries()) {
      const before = JSON.stringify(state);
      const r = apply(tight, state, answer);
      if (!r.ok) {
        expect(r.error.code).toBe("stepBudgetExceeded");
        expect(JSON.stringify(state)).toBe(before);
        refusedAt = i;
        break;
      }
      state = deepFreeze(r.value.state);
    }
    // Some earlier calls fit the budget: it is the reactions built up over the turn that go over it.
    expect(refusedAt).toBeGreaterThan(2);
  });
  it("the same game with a large enough budget finishes", () => {
    expect(played(roomy, 1, 5).final.public.status.kind).toBe("over");
  });
});

describe("trigger bounds", () => {
  it("a turnEnd trigger that sets another turnEnd trigger: the second is set, never fires that turn, ends at the turn end, and is gone next turn", () => {
    const inner: Step = { op: "trigger", hook: "turnEnd", do: [marker("inner")], duration: { kind: "turnEnd" } };
    const outer: Step = { op: "trigger", hook: "turnEnd", do: [inner], duration: { kind: "turnEnd" } };
    // Only c1 sets the outer trigger; the other cards do nothing. LIO's hand order has c1 played first.
    const cards = Array.from({ length: 2 * LIO_CARDS }, (_, i) => card(`c${i + 1}`, i === 0 ? [outer] : []));
    const rules: Ruleset = deepFreeze({ id: "retrigger", cards });
    const { record, final } = played(rules, 2, 1);
    const lifecycle = eventsOf(rules, record)
      .filter((e) => e.kind === "triggerSet" || e.kind === "triggerFired" || e.kind === "triggerEnded")
      .map((e) => e.kind);
    // Set (outer), fired at the turn end, set (inner) by that reaction, then ended at that same turn end; never fired.
    expect(lifecycle).toEqual(["triggerSet", "triggerFired", "triggerSet", "triggerEnded"]);
    expect(eventsOf(rules, record).filter((e) => e.kind === "marker" && e.label === "inner")).toEqual([]);
    expect(final.public.turn).toBe(2);
    expect(final.public.triggers).toEqual([]);
  });
  it("a game where every play sets a cardPlayed trigger ends with no triggers or modifiers, and none fired for the card that set it", () => {
    const effect: Step[] = [
      { op: "modifier", mod: { hook: "opsValue", side: "both", add: 1 }, duration: { kind: "turnEnd" } },
      { op: "trigger", hook: "cardPlayed", do: [marker("reacted", "card")], duration: { kind: "turnEnd" } },
    ];
    const rules = allCards("self-trigger", effect);
    const { record, final } = played(rules, 2, 3);
    expect(final.public.triggers).toEqual([]);
    expect(final.public.modifiers).toEqual([]);
    // Reactions run in the order the triggers were set, as their triggerFired events were told.
    const firing: string[] = [];
    let reactions = 0;
    for (const e of eventsOf(rules, record)) {
      if (e.kind === "triggerFired") firing.push(e.source);
      if (e.kind === "marker" && e.label === "reacted") {
        reactions++;
        expect(firing.shift()).not.toBe(e.value);
      }
    }
    expect(reactions).toBeGreaterThan(0);
  });
});
