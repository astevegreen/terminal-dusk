// Number tests (atLeast, atMost, equals) and the addToNumber step (#74): a card changes the number a
// Contingency draw gave and branches on the result.
import { describe, expect, it } from "vitest";
import { apply } from "./index.ts";
import type { Condition, GameState, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  choose,
  forEach,
  ifYes,
  marker,
  markers,
  openWith,
  playAnswer,
  orderAnswer,
  applied,
  ruleset,
  setupPlus,
  sideCard,
  startAtPlay,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";

const draw: Step = { op: "drawContingency", side: "lio", bind: "n" };
const add = (amount: number, v = "n"): Step => ({ op: "addToNumber", var: v, amount });
const test = (op: "atLeast" | "atMost" | "equals", value: number, then: Step[], otherwise?: Step[]): Step => {
  const cond: Condition = { op, var: "n", value };
  return otherwise === undefined ? { op: "if", cond, then } : { op: "if", cond, then, else: otherwise };
};

/** A game at LIO's first play whose LIO Contingency deck is all `n`, so every draw gives `n`. */
const drawing = (n: number, rs = ruleset, extra: { lio?: string[] } = {}): GameState =>
  openWith(
    startGame(2, 1, rs, { ...setupPlus(extra), contingency: { lio: [n, n, n], sae: [1, 2, 3] } }),
    "l1",
    "s1",
    rs,
  ).state;
const run = (n: number, steps: Step[]) => startWith([draw, ...steps], ruleset, drawing(n));
const labels = (n: number, steps: Step[]) => markers(run(n, steps).events);

describe("number tests on a draw", () => {
  it.each([
    [3, "no"],
    [4, "yes"],
    [5, "yes"],
  ])("atLeast 4: a draw of %i takes the %s branch", (n, want) => {
    expect(labels(n, [test("atLeast", 4, [marker("yes")], [marker("no")])])).toEqual([want]);
  });

  it.each([
    [3, "yes"],
    [4, "yes"],
    [5, "no"],
  ])("atMost 4: a draw of %i takes the %s branch", (n, want) => {
    expect(labels(n, [test("atMost", 4, [marker("yes")], [marker("no")])])).toEqual([want]);
  });

  it.each([
    [3, "no"],
    [4, "yes"],
    [5, "no"],
  ])("equals 4: a draw of %i takes the %s branch", (n, want) => {
    expect(labels(n, [test("equals", 4, [marker("yes")], [marker("no")])])).toEqual([want]);
  });

  it("with no else branch, a failed test does nothing and the program goes on", () => {
    expect(labels(1, [test("atLeast", 4, [marker("yes")]), marker("after")])).toEqual(["after"]);
  });
});

describe("the addToNumber step", () => {
  it("adds to the draw: a marker shows the number plus 1, and an atLeast test sees the changed number", () => {
    const out = labels(3, [add(1), marker("n", "n"), test("atLeast", 4, [marker("yes")], [marker("no")])]);
    expect(out).toEqual(["n:4", "yes"]);
  });

  it("negative amounts subtract, with no minimum or maximum: a 1 with -1 is 0, a 6 with +1 is 7", () => {
    expect(labels(1, [add(-1), marker("n", "n")])).toEqual(["n:0"]);
    expect(labels(6, [add(1), marker("n", "n")])).toEqual(["n:7"]);
    expect(labels(1, [add(-3), marker("n", "n")])).toEqual(["n:-2"]);
  });

  it("inside an if branch, changes the number a step after that if reads", () => {
    const out = labels(2, [test("atMost", 3, [add(5)]), marker("n", "n")]);
    expect(out).toEqual(["n:7"]);
  });

  it("inside a forEach body, changes the number each time round", () => {
    expect(labels(2, [forEach(["a", "b"], "x", [add(1)]), marker("n", "n")])).toEqual(["n:4"]);
  });

  it("an unbound variable gives invalidProgram, like an unbound yes/no test", () => {
    const r = startProgram(ruleset, startAtPlay(), [add(1, "nope")]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram", message: expect.stringContaining("nope") } });
  });
});

describe("number steps on a variable that is not a number", () => {
  it("addToNumber on a yes/no answer is invalidProgram naming the variable", () => {
    const first = startWith([choose("n"), add(1)]);
    const r = apply(ruleset, first.state, {
      decisionId: first.state.public.pending[0]!.id,
      side: "lio",
      value: { kind: "yesNo", yes: true },
    });
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram", message: expect.stringContaining('"n"') } });
  });

  it("a number test on a yes/no answer is invalidProgram naming the variable", () => {
    const first = startWith([choose("n"), test("atLeast", 1, [marker("x")])]);
    const r = apply(ruleset, first.state, {
      decisionId: first.state.public.pending[0]!.id,
      side: "lio",
      value: { kind: "yesNo", yes: true },
    });
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram", message: expect.stringContaining('"n"') } });
  });

  it("a number test or addToNumber on both sides' answers is invalidProgram", () => {
    for (const step of [test("equals", 1, [marker("x")]), add(1)]) {
      const first = startWith([choose("n", "both"), step]);
      const ids = first.state.public.pending;
      const a = apply(ruleset, first.state, {
        decisionId: ids[0]!.id,
        side: ids[0]!.side,
        value: { kind: "yesNo", yes: true },
      });
      if (!a.ok) throw new Error(a.error.code);
      const b = apply(ruleset, a.value.state, {
        decisionId: a.value.state.public.pending[0]!.id,
        side: a.value.state.public.pending[0]!.side,
        value: { kind: "yesNo", yes: false },
      });
      expect(b).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
    }
  });

  it("a number test or addToNumber on a forEach item is invalidProgram", () => {
    for (const step of [test("equals", 1, [marker("x")]), add(1, "x")]) {
      const cond = step.op === "if" ? { ...step, cond: { op: "equals" as const, var: "x", value: 1 } } : step;
      const r = startProgram(ruleset, startAtPlay(), [forEach(["a"], "x", [cond])]);
      expect(r).toMatchObject({
        ok: false,
        error: { code: "invalidProgram", message: expect.stringContaining('"x"') },
      });
    }
  });

  it("an unbound variable in a number test gives invalidProgram", () => {
    const r = startProgram(ruleset, startAtPlay(), [test("atLeast", 1, [marker("x")])]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });

  it("the yes/no test on a number still returns invalidProgram", () => {
    const r = startProgram(ruleset, startAtPlay(), [draw, ifYes("n", [marker("yes")])]);
    expect(r).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });
});

describe("a played card that draws, adds and branches", () => {
  it("apply never changes deep-frozen inputs", () => {
    const rs = deepFreeze(
      withCards(sideCard("l9", 2, [draw, add(1), test("atLeast", 4, [marker("high", "n")], [marker("low", "n")])])),
    );
    const s = deepFreeze(drawing(3, rs, { lio: ["l9"] }));
    const before = JSON.stringify(s);
    const r = apply(rs, s, deepFreeze(playAnswer(s, "lio", "l9", "event")));
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    expect(markers(r.value.events)).toEqual(["high:4"]);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("works the same when the rival plays the card for points and orders its event", () => {
    const rs = withCards(
      sideCard("s9", 2, [{ op: "drawContingency", side: "sae", bind: "n" }, add(2), marker("n", "n")]),
    );
    const s = openWith(
      startGame(2, 1, rs, { ...setupPlus({ lio: ["s9"] }), contingency: { lio: [1, 2, 3], sae: [2, 2, 2] } }),
      "l1",
      "s1",
      rs,
    ).state;
    const waiting = applied(s, playAnswer(s, "lio", "s9", "points"), rs).state;
    expect(markers(applied(waiting, orderAnswer(waiting, "lio", "before"), rs).events)).toEqual(["n:4"]);
  });
});
