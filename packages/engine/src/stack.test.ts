import { describe, expect, it } from "vitest";
import { apply, legalAnswers, pendingFor } from "./index.ts";
import type { Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  answerYesNo,
  choose,
  forEach,
  ifYes,
  marker,
  markers,
  ruleset,
  startAtPlay,
  startGame,
  startWith,
  yesNoAnswer,
} from "./test/game.ts";

describe("resolution stack: choose, if, forEach and marker", () => {
  // "choose yes or no; if yes, a marker for each of three items; otherwise one marker"
  const program = [choose("go"), ifYes("go", [forEach(["a", "b", "c"], "x", [marker("item", "x")])], [marker("no")])];

  it("the program pauses at the choice, with a yesNo decision for the chooser and nothing run yet", () => {
    const { state, events } = startWith(program);
    expect(markers(events)).toEqual([]);
    expect(state.public.pending).toEqual([{ id: expect.any(String), side: "lio", kind: "yesNo", options: {} }]);
    expect(pendingFor(state, "sae")).toBeNull();
    expect(state.public.stack).toHaveLength(1);
    expect(legalAnswers(ruleset, state, "lio")).toEqual([
      { kind: "yesNo", yes: true },
      { kind: "yesNo", yes: false },
    ]);
  });
  it("answering yes runs the yes branch: a marker for each of three items", () => {
    const paused = startWith(program).state;
    const { state, events } = answerYesNo(paused, true);
    expect(markers(events)).toEqual(["item:a", "item:b", "item:c"]);
    expect(state.public.stack).toEqual([]);
  });
  it("answering no runs the other branch: one marker", () => {
    const paused = startWith(program).state;
    expect(markers(answerYesNo(paused, false).events)).toEqual(["no"]);
  });
  it("a forEach over a, b, c binding x, with body marker item x, emits a, b and c in that order", () => {
    const { events } = startWith([forEach(["a", "b", "c"], "x", [marker("item", "x")])]);
    expect(events).toEqual([
      { kind: "marker", visibility: "public", label: "item", value: "a" },
      { kind: "marker", visibility: "public", label: "item", value: "b" },
      { kind: "marker", visibility: "public", label: "item", value: "c" },
    ]);
  });
  it("a marker without a variable has no value field", () => {
    expect(startWith([marker("plain")]).events).toEqual([{ kind: "marker", visibility: "public", label: "plain" }]);
  });
  it("a choose inside a forEach resumes with the remaining items after the answer, and does not restart the loop", () => {
    const loop = [forEach(["a", "b", "c"], "x", [marker("before", "x"), choose("ok"), marker("after", "x")])];
    let played = startWith(loop);
    expect(markers(played.events)).toEqual(["before:a"]);
    played = answerYesNo(played.state, true);
    expect(markers(played.events)).toEqual(["after:a", "before:b"]);
    played = answerYesNo(played.state, false);
    expect(markers(played.events)).toEqual(["after:b", "before:c"]);
    played = answerYesNo(played.state, true);
    expect(markers(played.events)).toEqual(["after:c"]);
    expect(played.state.public.stack).toEqual([]);
  });
  it("after an if, the next marker runs once, whichever branch ran", () => {
    const afterIf = [choose("go"), ifYes("go", [marker("then")], [marker("else")]), marker("after")];
    expect(markers(answerYesNo(startWith(afterIf).state, true).events)).toEqual(["then", "after"]);
    expect(markers(answerYesNo(startWith(afterIf).state, false).events)).toEqual(["else", "after"]);
    const noElse = [choose("go"), ifYes("go", [marker("then")]), marker("after")];
    expect(markers(answerYesNo(startWith(noElse).state, false).events)).toEqual(["after"]);
  });
  it("after a forEach, the next marker runs once, after the last item", () => {
    const afterLoop = [forEach(["a", "b", "c"], "x", [marker("item", "x")]), marker("after")];
    expect(markers(startWith(afterLoop).events)).toEqual(["item:a", "item:b", "item:c", "after"]);
  });
  it("nested blocks (an if inside a forEach inside an if) pause and resume to give exactly the expected markers", () => {
    const nested = [
      marker("before outer if"),
      choose("go"),
      ifYes("go", [
        marker("before forEach"),
        forEach(["a", "b"], "x", [
          marker("before inner if", "x"),
          ifYes("go", [choose("pick", "sae"), marker("picked", "pick")]),
          marker("after inner if", "x"),
        ]),
        marker("after forEach"),
      ]),
      marker("after outer if"),
    ];
    let played = startWith(nested);
    expect(markers(played.events)).toEqual(["before outer if"]);
    expect(played.state.public.pending[0]?.side).toBe("lio");
    played = answerYesNo(played.state, true);
    expect(markers(played.events)).toEqual(["before forEach", "before inner if:a"]);
    expect(played.state.public.pending[0]?.side).toBe("sae");
    played = answerYesNo(played.state, true);
    expect(markers(played.events)).toEqual(["picked:true", "after inner if:a", "before inner if:b"]);
    played = answerYesNo(played.state, false);
    expect(markers(played.events)).toEqual(["picked:false", "after inner if:b", "after forEach", "after outer if"]);
    expect(played.state.public.stack).toEqual([]);
  });
  it("a forEach over an empty list runs nothing", () => {
    const { state, events } = startWith([forEach([], "x", [marker("item", "x")]), marker("after")]);
    expect(markers(events)).toEqual(["after"]);
    expect(state.public.stack).toEqual([]);
  });
  it("variables and the forEach position are stored in the frames", () => {
    const loop = [choose("go"), forEach(["a", "b", "c"], "x", [choose("ok")])];
    let state = answerYesNo(startWith(loop).state, true).state;
    state = answerYesNo(state, false).state;
    const [program, loopFrame] = state.public.stack;
    expect(program).toMatchObject({ kind: "program", vars: [{ name: "go", value: true }] });
    expect(loopFrame).toMatchObject({
      kind: "forEach",
      items: ["a", "b", "c"],
      index: 1,
      vars: [{ name: "x", value: "b" }],
    });
  });
  it("a state paused mid-program survives a JSON round trip, and resuming the copy gives the same result", () => {
    const loop = [forEach(["a", "b", "c"], "x", [marker("before", "x"), choose("ok"), marker("after", "x")])];
    const paused = deepFreeze(answerYesNo(startWith(loop).state, true).state);
    const parsed = JSON.parse(JSON.stringify(paused)) as typeof paused;
    expect(parsed).toStrictEqual(paused);
    const fromOriginal = apply(ruleset, paused, yesNoAnswer(paused, false));
    const fromCopy = apply(ruleset, parsed, yesNoAnswer(parsed, false));
    expect(fromCopy).toStrictEqual(fromOriginal);
    expect(fromOriginal.ok && markers(fromOriginal.value.events)).toEqual(["after:b", "before:c"]);
  });
});

describe("resolution stack and the turn structure", () => {
  it("starting a program does not change its input, and gives the new decision an unused ID", () => {
    const s = deepFreeze(startAtPlay());
    const before = JSON.stringify(s);
    const { state } = startWith([choose("go")], ruleset, s);
    expect(JSON.stringify(s)).toBe(before);
    expect(state.public.pending[0]?.id).not.toBe(s.public.pending[0]?.id);
  });
  it("a program that never pauses leaves the open play decision in place", () => {
    const s = startAtPlay();
    expect(startWith([marker("m")], ruleset, s).state.public.pending).toEqual(s.public.pending);
  });
  it("when a paused program finishes, the play it interrupted is open again: still LIO's, whoever answered", () => {
    for (const chooser of ["lio", "sae"] as const) {
      const { state } = answerYesNo(startWith([choose("go", chooser)]).state, true);
      expect(state.public.stack).toEqual([]);
      expect(state.public.playsMade).toBe(0);
      expect(state.public.pending).toEqual([
        {
          id: expect.any(String),
          side: "lio",
          kind: "playCardAs",
          options: {
            from: "hand",
            uses: { own: ["event", "points"], rival: ["points"], neutral: ["event", "points"] },
          },
        },
      ]);
    }
  });
  it("resigning while a program is paused ends the game and clears the stack", () => {
    const paused = startWith([choose("go")]).state;
    const r = apply(ruleset, paused, { system: "resign", side: "lio" });
    expect(r.ok && r.value.state.public.stack).toEqual([]);
    expect(r.ok && r.value.state.public.status).toMatchObject({ kind: "over", winner: "sae" });
  });
  it("a program cannot start while another is paused, during the opening pick, or once the game is over", () => {
    const paused = startWith([choose("go")]).state;
    expect(startProgram(ruleset, paused, [marker("m")])).toMatchObject({ ok: false, error: { code: "notSupported" } });
    expect(startProgram(ruleset, startGame(), [marker("m")])).toMatchObject({
      ok: false,
      error: { code: "notSupported" },
    });
    const over = apply(ruleset, paused, { system: "resign", side: "lio" });
    if (!over.ok) throw new Error("resign rejected");
    expect(startProgram(ruleset, over.value.state, [marker("m")])).toMatchObject({
      ok: false,
      error: { code: "gameOver" },
    });
  });
  it("a variable that is not bound returns invalidProgram and changes nothing", () => {
    const s = deepFreeze(startAtPlay());
    for (const steps of [[marker("m", "nope")], [ifYes("nope", [marker("m")])]]) {
      expect(startProgram(ruleset, s, steps)).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
    }
  });
  it("an if on a forEach item (not a yes/no answer) returns invalidProgram", () => {
    const steps = [forEach(["a"], "x", [ifYes("x", [marker("m")])])];
    expect(startProgram(ruleset, startAtPlay(), steps)).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });
  it("a playedBy in a program no card started (no recorded player) returns invalidProgram, saying it needs that side", () => {
    const s = deepFreeze(startAtPlay());
    const steps = [forEach(["a"], "x", [{ op: "if", cond: { op: "playedBy", side: "lio" }, then: [marker("m")] }])];
    expect(startProgram(ruleset, s, steps)).toMatchObject({
      ok: false,
      error: { code: "invalidProgram", message: expect.stringContaining("the side that played the card") },
    });
  });
  it("a playedBy reads no variable: one named var is ignored, and the recorded player decides", () => {
    const steps = [{ op: "if", cond: { op: "playedBy", side: "sae", var: "nope" }, then: [marker("m")] }];
    const r = startProgram(ruleset, startAtPlay(), steps as unknown as Step[], "n2", "sae");
    expect(r.ok && markers(r.value.events)).toEqual(["m"]);
  });
  it("variables bound inside a block are not visible after it ends", () => {
    const steps = [forEach(["a"], "x", []), marker("m", "x")];
    expect(startProgram(ruleset, startAtPlay(), steps)).toMatchObject({ ok: false, error: { code: "invalidProgram" } });
  });
  it("events from a program are public", () => {
    const { events } = startWith([marker("m")]);
    expect(events.every((e) => e.visibility === "public")).toBe(true);
  });
});
