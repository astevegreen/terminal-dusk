// The fuzz suite and the lasting markers and `has` conditions of R4a (#142): the fuzz cards set and test
// them, the games take both branches, and the checks catch a lost, moved or doubled marker and a wrong branch.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Ruleset, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkHasBranches, checkMarkers } from "./checks.ts";
import { branchLabel, branchOf, isLasting, LASTING_LABELS } from "./markers.ts";
import { DEFAULT_GAMES, playFuzzGame, ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { playReactionGame, reactionsRuleset } from "./reactions.ts";

const SEED = "marker-seed";
const SETUP = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
  deck: ["c6"],
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
};

/** Every step in `steps`, at any depth, with whether it sits inside a trigger's reaction. */
function stepsIn(steps: readonly Step[], inReaction = false): { step: Step; inReaction: boolean }[] {
  return steps.flatMap((step) => {
    const inner =
      step.op === "if"
        ? [...step.then, ...(step.else ?? [])]
        : step.op === "trigger" || step.op === "forEach"
          ? step.do
          : [];
    return [{ step, inReaction }, ...stepsIn(inner, inReaction || step.op === "trigger")];
  });
}
const allSteps = (rules: Ruleset) => rules.cards.flatMap((card) => stepsIn(card.effect));
const lastingSet = (rules: Ruleset) =>
  allSteps(rules).flatMap(({ step }) => (step.op === "marker" && step.lasting === true ? [step.label] : []));
const hasTested = (rules: Ruleset) =>
  allSteps(rules).flatMap(({ step }) => (step.op === "if" && step.cond.op === "has" ? [step] : []));

describe.each([
  ["fuzz", ruleset, false],
  ["reaction", reactionsRuleset, true],
] as const)("the %s cards set lasting markers and test them with has", (_, rules, inReaction) => {
  it("set lasting markers from the small fixed set of labels, each label on more than one card", () => {
    const set = lastingSet(rules);
    expect(new Set(set)).toEqual(new Set(LASTING_LABELS));
    for (const label of LASTING_LABELS) expect(set.filter((l) => l === label).length).toBeGreaterThan(1);
  });
  it("test every label with has, each branch recording a plain marker naming the label and the branch", () => {
    const tests = hasTested(rules);
    expect(new Set(tests.map((s) => s.cond.op === "has" && s.cond.marker))).toEqual(new Set(LASTING_LABELS));
    for (const s of tests) {
      const label = s.cond.op === "has" ? s.cond.marker : "";
      expect(s.then).toEqual([{ op: "marker", label: branchLabel(label, "then", inReaction) }]);
      expect(s.else).toEqual([{ op: "marker", label: branchLabel(label, "else", inReaction) }]);
    }
  });
  it("set lasting every label they test with has, so the ruleset passes createGame's checks on its own", () => {
    for (const s of hasTested(rules)) expect(lastingSet(rules)).toContain(s.cond.op === "has" && s.cond.marker);
    expect(createGame(rules, SETUP, SEED).ok).toBe(true);
  });
});

describe("the reaction cards' lasting markers and has conditions", () => {
  it("are all inside a trigger's reaction, so every one the reaction games run ran in a reaction", () => {
    const found = allSteps(reactionsRuleset).filter(
      ({ step }) => (step.op === "marker" && step.lasting === true) || (step.op === "if" && step.cond.op === "has"),
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(({ inReaction }) => inReaction)).toBe(true);
  });
});

/** A new one-turn game with known cards. */
function started(): GameState {
  const r = createGame(ruleset, SETUP, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}
const withMarkers = (markers: string[]): GameState => {
  const s = started();
  return { ...s, public: { ...s.public, markers } };
};
const lasting = (label: string): GameEvent => ({ kind: "marker", visibility: "public", label, lasting: true });
const plain = (label: string): GameEvent => ({ kind: "marker", visibility: "public", label });
const branch = (label: string, taken: "then" | "else"): GameEvent => plain(branchLabel(label, taken, false));

describe("checkMarkers", () => {
  it("passes a new game, and a step that adds its lasting labels in first-event order after the ones before", () => {
    expect(() => checkMarkers(started(), [], null)).not.toThrow();
    const events = [lasting("x"), lasting("y"), lasting("x"), lasting("a")];
    expect(() => checkMarkers(withMarkers(["a", "x", "y"]), events, ["a"])).not.toThrow();
  });
  it("catches a new game that already holds a lasting marker", () => {
    expect(() => checkMarkers(withMarkers(["x"]), [], null)).toThrow(/a new game already holds/);
  });
  it("catches a label held twice", () => {
    expect(() => checkMarkers(withMarkers(["x", "x"]), [lasting("x")], [])).toThrow(/more than once/);
  });
  it("catches a label lost, and labels reordered", () => {
    expect(() => checkMarkers(withMarkers(["y"]), [], ["x", "y"])).toThrow(/do not start with the ones before/);
    expect(() => checkMarkers(withMarkers(["y", "x"]), [], ["x", "y"])).toThrow(/do not start with the ones before/);
  });
  it("catches a lasting marker event whose label is not in the list", () => {
    expect(() => checkMarkers(withMarkers([]), [lasting("x")], [])).toThrow(/were set, but the lasting markers are/);
  });
  it("catches a label added with no lasting event, one added for a plain marker, and additions out of order", () => {
    expect(() => checkMarkers(withMarkers(["x"]), [], [])).toThrow(/added are \["x"\]/);
    expect(() => checkMarkers(withMarkers(["x"]), [plain("x")], [])).toThrow(/added are \["x"\]/);
    const events = [lasting("x"), lasting("y")];
    expect(() => checkMarkers(withMarkers(["y", "x"]), events, [])).toThrow(/added are \["y","x"\]/);
  });
});

describe("checkHasBranches", () => {
  it("passes else before the label is set and then after, in event order, even within one step", () => {
    expect(() => checkHasBranches([branch("x", "else"), lasting("x"), branch("x", "then")])).not.toThrow();
  });
  it("catches then with no lasting marker earlier, even when one comes later", () => {
    expect(() => checkHasBranches([branch("x", "then"), lasting("x")])).toThrow(/took "then", but none/);
  });
  it("catches else after a lasting marker was set", () => {
    expect(() => checkHasBranches([lasting("x"), branch("x", "else")])).toThrow(/took "else", but one had been set/);
  });
  it("does not count a plain marker with the same label as setting it", () => {
    expect(() => checkHasBranches([plain("x"), branch("x", "then")])).toThrow(/took "then"/);
  });
});

/** Every event of a played game, replayed answer by answer. */
function eventsOf(rules: Ruleset, record: GameRecord): GameEvent[] {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const events = [...created.value.events];
  for (const answer of record.answers) {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  }
  return events;
}

type Counts = { lasting: number; then: number; else: number };
const zero = (): Counts => ({ lasting: 0, then: 0, else: 0 });

/** Adds a game's lasting markers set and has branches taken to `counts`. */
function count(counts: Counts, events: readonly GameEvent[], inReaction: boolean): void {
  for (const event of events) {
    if (isLasting(event)) counts.lasting++;
    const taken = branchOf(event);
    if (taken !== null) {
      expect(taken.inReaction).toBe(inReaction);
      counts[taken.branch]++;
    }
  }
}

describe("lasting markers and has in the fuzz games", () => {
  it(`within ${DEFAULT_GAMES} fuzz games and as many reaction games, lasting markers are set and has takes both branches, in effects and in reactions`, () => {
    const effects = zero();
    const reactions = zero();
    for (let game = 1; game <= DEFAULT_GAMES; game++) {
      // Each game runs every check, the marker checks included, and throws with its record if one fails.
      count(effects, eventsOf(ruleset, playFuzzGame(game).record), false);
      count(reactions, eventsOf(reactionsRuleset, playReactionGame(game).record), true);
    }
    for (const counts of [effects, reactions]) {
      expect(counts.lasting).toBeGreaterThan(0);
      expect(counts.then).toBeGreaterThan(0);
      expect(counts.else).toBeGreaterThan(0);
    }
  }, 120_000);
});
