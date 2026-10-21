// The fuzz suite and the playedBy condition of R5a (#170): the fuzz cards test who played them, at the top of
// an effect, nested in another if and in both kinds of reaction; every fuzz game checks each test took exactly
// one branch, the right one; and the games take both branches in every place and for every kind of play.
import { apply, createGame } from "@terminal-dusk/engine";
import type { Answer, CardId, GameEvent, Ruleset, Side, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAMES, playFuzzGame, ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { announcedTest, branchLabel, checkPlayedBy, notePlay, PLAYED_BY } from "./playedBy.ts";
import type { Branch, PlayRecord, Taken, Where } from "./playedBy.ts";
import { playReactionGame, reactionsRuleset } from "./reactions.ts";

const plain = (label: string): GameEvent => ({ kind: "marker", visibility: "public", label });
const announce = (card: CardId, side: Side, where: Where = "top"): GameEvent =>
  plain(`${PLAYED_BY}${card}:${side}:${where}`);
const branch = (card: CardId, taken: Branch): GameEvent => plain(branchLabel(card, taken));

describe("the playedBy check", () => {
  const plays = new Map<CardId, PlayRecord>([["c3", { side: "lio", how: "event" }]]);
  it("passes a test that took then for the side that played the card, and else for the other side", () => {
    const events = [announce("c3", "lio"), branch("c3", "then"), announce("c3", "sae", "nested"), branch("c3", "else")];
    expect(checkPlayedBy(events, plays).map((t) => [t.side, t.where, t.branch])).toEqual([
      ["lio", "top", "then"],
      ["sae", "nested", "else"],
    ]);
  });
  it("fails a step's events checked against a swapped player record", () => {
    const swapped = new Map<CardId, PlayRecord>([["c3", { side: "sae", how: "event" }]]);
    expect(() => checkPlayedBy([announce("c3", "lio"), branch("c3", "then")], swapped)).toThrow(
      /c3's playedBy lio test \(top\) took "then", but sae picked or played it/,
    );
  });
  it("fails an announced test with no branch marker, at the end of the step or before the next test", () => {
    expect(() => checkPlayedBy([announce("c3", "lio")], plays)).toThrow(/took no branch/);
    expect(() => checkPlayedBy([announce("c3", "lio"), announce("c3", "sae"), branch("c3", "else")], plays)).toThrow(
      /c3's playedBy lio test \(top\) took no branch/,
    );
  });
  it("fails a test followed by two branch markers, a branch for another card, or a branch with no test", () => {
    const twice = [announce("c3", "lio"), branch("c3", "then"), branch("c3", "else")];
    expect(() => checkPlayedBy(twice, plays)).toThrow(/has no test announced/);
    expect(() => checkPlayedBy([announce("c3", "lio"), branch("c6", "then")], plays)).toThrow(/c6/);
    expect(() => checkPlayedBy([branch("c3", "then")], plays)).toThrow(/has no test announced/);
  });
  it("fails a test of a card no side picked or played", () => {
    expect(() => checkPlayedBy([announce("c6", "lio"), branch("c6", "then")], plays)).toThrow(/no side picked/);
  });
});

describe("notePlay", () => {
  // c1 is LIO's, c2 SAE's and c3 neutral (the fuzz cards' affiliations go lio, sae, neutral).
  const noted = (answer: Answer, card: CardId): PlayRecord | undefined => {
    const plays = new Map<CardId, PlayRecord>();
    notePlay(plays, ruleset, answer);
    return plays.get(card);
  };
  const play = (side: Side, card: CardId, as: "event" | "points"): Answer => ({
    decisionId: "d2",
    side,
    value: { kind: "playCardAs", card, as },
  });
  it("records the side and how: an opening pick, an event, the rival's card for its points, or a card's points", () => {
    const pick: Answer = { decisionId: "d0-sae", side: "sae", value: { kind: "chooseCard", card: "c1" } };
    expect(noted(pick, "c1")).toEqual({ side: "sae", how: "opening" });
    expect(noted(play("lio", "c1", "event"), "c1")).toEqual({ side: "lio", how: "event" });
    expect(noted(play("sae", "c1", "points"), "c1")).toEqual({ side: "sae", how: "rivalPoints" });
    expect(noted(play("lio", "c1", "points"), "c1")).toEqual({ side: "lio", how: "points" });
    expect(noted(play("sae", "c3", "points"), "c3")).toEqual({ side: "sae", how: "points" });
  });
});

/** Every playedBy if in `steps`, at any depth, with the step straight before it and whether it is in a reaction. */
type Found = { step: Extract<Step, { op: "if" }>; before: Step | undefined; hook: string | null };
function playedByIfs(steps: readonly Step[], hook: string | null = null): Found[] {
  return steps.flatMap((step, i) => {
    const own = step.op === "if" && step.cond.op === "playedBy" ? [{ step, before: steps[i - 1], hook }] : [];
    if (step.op === "if") return [...own, ...playedByIfs([...step.then, ...(step.else ?? [])], hook)];
    if (step.op === "trigger") return playedByIfs(step.do, step.hook);
    return step.op === "forEach" ? playedByIfs(step.do, hook) : [];
  });
}
/** True when `steps` hold only markers and announced playedBy ifs, at any depth. */
const onlyMarkers = (steps: readonly Step[]): boolean =>
  steps.every(
    (s) =>
      s.op === "marker" || (s.op === "if" && s.cond.op === "playedBy" && onlyMarkers([...s.then, ...(s.else ?? [])])),
  );

describe("the fuzz cards test playedBy", () => {
  const found = [ruleset, reactionsRuleset].flatMap((rules) =>
    rules.cards.flatMap((card) => playedByIfs(card.effect).map((f) => ({ ...f, card }))),
  );
  it("on LIO, SAE and neutral cards, for both sides, at the top level, nested in an if, and in both kinds of reaction", () => {
    expect(new Set(found.map((f) => f.card.affiliation))).toEqual(new Set(["lio", "sae", "neutral"]));
    expect(new Set(found.map((f) => f.step.cond.op === "playedBy" && f.step.cond.side))).toEqual(
      new Set(["lio", "sae"]),
    );
    const places = new Set(
      found.map((f) => (f.before?.op === "marker" ? announcedTest(plain(f.before.label))?.where : null)),
    );
    expect(places).toEqual(new Set(["top", "nested", "turnEnd", "cardPlayed"]));
  });
  it("announce each test with a marker straight before its if, naming the card, the side tested and its place", () => {
    for (const { step, before, hook, card } of found) {
      const announced = before?.op === "marker" ? announcedTest(plain(before.label)) : null;
      const side = step.cond.op === "playedBy" ? step.cond.side : null;
      expect(announced?.card).toBe(card.id);
      expect(announced?.side).toBe(side);
      if (hook !== null) expect(announced?.where).toBe(hook);
    }
  });
  it("hold only markers in their branches, each branch starting with the marker naming it", () => {
    for (const { step, card } of found) {
      expect(step.then[0]).toEqual({ op: "marker", label: branchLabel(card.id, "then") });
      expect(step.else?.[0]).toEqual({ op: "marker", label: branchLabel(card.id, "else") });
      expect(onlyMarkers([step])).toBe(true);
    }
  });
});

/** A played game replayed answer by answer: each step's events, and the play records as they stood for it. */
function stepsOf(rules: Ruleset, record: GameRecord): { events: GameEvent[]; plays: Map<CardId, PlayRecord> }[] {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const plays = new Map<CardId, PlayRecord>();
  return record.answers.map((answer) => {
    notePlay(plays, rules, answer);
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    return { events: r.value.events, plays: new Map(plays) };
  });
}

const swap = (plays: Map<CardId, PlayRecord>): Map<CardId, PlayRecord> =>
  new Map([...plays].map(([card, p]) => [card, { ...p, side: p.side === "lio" ? "sae" : "lio" }]));

describe("the playedBy check on a real game", () => {
  it("fails a fuzz game's step that took playedBy tests when the player record is swapped", () => {
    const step = stepsOf(ruleset, playFuzzGame(1).record).find((s) => s.events.some((e) => announcedTest(e)));
    expect(step).toBeDefined();
    expect(checkPlayedBy(step!.events, step!.plays).length).toBeGreaterThan(0);
    expect(() => checkPlayedBy(step!.events, swap(step!.plays))).toThrow(/but (lio|sae) picked or played it/);
  });
});

const CATEGORIES = ["lio", "sae", "neutral", "opening", "rivalPoints", "nested", "turnEnd", "cardPlayed"] as const;
type Counts = Record<(typeof CATEGORIES)[number], Record<Branch, number>>;

/** Adds each playedBy test taken in `tests` to every category it belongs to. */
function count(counts: Counts, rules: Ruleset, tests: readonly Taken[]): void {
  for (const t of tests) {
    const affiliation = rules.cards.find((c) => c.id === t.card)!.affiliation;
    const kinds = [affiliation, t.where, t.play.how].filter((k): k is keyof Counts => k in counts);
    for (const kind of kinds) counts[kind][t.branch]++;
  }
}

describe("playedBy in the fuzz games", () => {
  it(`over ${DEFAULT_GAMES} fuzz games and as many reaction games, playedBy takes both branches on each kind of card, play and place`, () => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, { then: 0, else: 0 }])) as Counts;
    for (let game = 1; game <= DEFAULT_GAMES; game++) {
      // Each game runs every check, the playedBy check included, and throws with its record if one fails.
      for (const [rules, played] of [
        [ruleset, playFuzzGame(game)],
        [reactionsRuleset, playReactionGame(game)],
      ] as const) {
        for (const step of stepsOf(rules, played.record)) count(counts, rules, checkPlayedBy(step.events, step.plays));
      }
    }
    for (const category of CATEGORIES) {
      expect({ category, then: counts[category].then > 0, else: counts[category].else > 0 }).toEqual({
        category,
        then: true,
        else: true,
      });
    }
  }, 120_000);
});
