// Tests for the trigger filter and once check (filterChecks.ts, #190), on small fixed games whose cards are
// defined here: it passes real steps, both kinds of play included, and fails a filtered trigger firing for the
// wrong side, a once trigger firing twice or staying, and a matching trigger that did not fire.
import { apply, createGame, legalAnswers, pendingFor, seedHash, SIDES } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Ruleset, Setup, Step, TriggerFilter } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "./deepFreeze.ts";
import { checkTriggerFilters } from "./filterChecks.ts";
import { playGame } from "./play.ts";
import type { Chooser } from "./play.ts";

/** Cards c1 to c20 are LIO's and c21 to c40 SAE's. LIO opens with c1 and plays c2, c3; SAE opens with c21, plays c22, c23. */
const LIO_CARDS = 20;
const marker = (label: string, lasting = false): Step => ({ op: "marker", label, ...(lasting ? { lasting } : {}) });
const asks: Step = { op: "choose", who: "sae", decision: { kind: "yesNo" }, bind: "a" };
function trigger(hook: "cardPlayed" | "turnEnd", label: string, filter?: TriggerFilter, once?: true): Step {
  return {
    op: "trigger",
    hook,
    ...(filter === undefined ? {} : { filter }),
    ...(once === undefined ? {} : { once }),
    do: [marker(label)],
    duration: { kind: "turnEnd" },
  };
}
/** A ruleset of cards c1 to c40 with the given effects; every other card does nothing. */
function rulesOf(id: string, effects: Record<string, Step[]>): Ruleset {
  const cards = Array.from({ length: 2 * LIO_CARDS }, (_, i) => ({
    id: `c${i + 1}`,
    era: "fuzz",
    ops: 1,
    affiliation: i < LIO_CARDS ? ("lio" as const) : ("sae" as const),
    effect: effects[`c${i + 1}`] ?? [],
  }));
  return deepFreeze({ id, cards });
}
const hand = (from: number, n: number): string[] => Array.from({ length: n }, (_, i) => `c${from + i}`);
function setup(playsPerTurn: number): Setup {
  return {
    seedHash: seedHash("filters"),
    hands: { lio: hand(1, 1 + playsPerTurn), sae: hand(LIO_CARDS + 1, 1 + playsPerTurn) },
    deck: [],
    turns: 1,
    playsPerTurn,
    handSize: 1 + playsPerTurn,
    contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  };
}
/** The first legal answer, preferring an event play, so each side plays its cards in hand order. */
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

type StepSeen = { before: GameState; events: GameEvent[]; after: GameState };
/** Plays the game (playGame runs the check on every step), then returns each step's states and events. */
function stepsOf(rules: Ruleset, playsPerTurn: number): StepSeen[] {
  const { record } = playGame(rules, "filters fixture", setup(playsPerTurn), "filters", eventChooser(rules));
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  return record.answers.map((answer) => {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    const seen = { before: state, events: r.value.events, after: r.value.state };
    state = r.value.state;
    return seen;
  });
}
const fired = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "triggerFired").map((e) => e.source);
/** The step whose events fire `source`'s trigger on `hook`. */
function stepFiring(steps: StepSeen[], source: string, hook = "cardPlayed"): StepSeen {
  const found = steps.find((s) =>
    s.events.some((e) => e.kind === "triggerFired" && e.source === source && e.hook === hook),
  );
  if (found === undefined) throw new Error(`no step fires ${source}'s ${hook} trigger`);
  return found;
}
const check = (rules: Ruleset, s: StepSeen) => checkTriggerFilters(rules, s.before, s.events, s.after);
const firedEvent = (source: string, hook: "cardPlayed" | "turnEnd" = "cardPlayed"): GameEvent => ({
  kind: "triggerFired",
  visibility: "public",
  source,
  hook,
});

describe("playedBy filters at the cardPlayed hook", () => {
  // c1 waits for LIO's plays, c21 for SAE's. LIO's c2 runs with no decision; SAE's c22 pauses on a question.
  const rules = rulesOf("playedBy-filters", {
    c1: [trigger("cardPlayed", "lioPlayed", { op: "playedBy", side: "lio" })],
    c21: [trigger("cardPlayed", "saePlayed", { op: "playedBy", side: "sae" })],
    c22: [asks],
  });
  const steps = stepsOf(rules, 1);
  const lioPlay = stepFiring(steps, "c1");
  const saeAnswer = stepFiring(steps, "c21");

  it("a play with no decision starts and fires in one step: inPlay was empty, and only the LIO-filtered trigger fires", () => {
    expect(lioPlay.before.public.inPlay).toEqual([]);
    expect(fired(lioPlay.events)).toEqual(["c1"]);
    expect(check(rules, lioPlay)).toMatchObject({ filteredFired: 1, filteredSkipped: 1 });
  });
  it("a play paused on a decision fires in a later step: inPlay holds it, playsMade counts it, and only the SAE-filtered trigger fires", () => {
    expect(saeAnswer.before.public.inPlay).toEqual(["c22"]);
    expect(saeAnswer.before.public.playsMade).toBe(2);
    expect(saeAnswer.before.public.pending[0]?.kind).toBe("yesNo");
    expect(fired(saeAnswer.events)).toEqual(["c21"]);
    expect(check(rules, saeAnswer)).toMatchObject({ filteredFired: 1, filteredSkipped: 1 });
  });
  it("fails a filtered trigger firing for the wrong side", () => {
    const events = lioPlay.events.flatMap((e) => (e.kind === "triggerFired" ? [e, firedEvent("c21")] : [e]));
    expect(() => check(rules, { ...lioPlay, events })).toThrow(
      /c21's cardPlayed trigger fired for a play by lio though its filter .*playedBy.*sae.* failed/,
    );
  });
  it("fails a matching trigger that did not fire, for either kind of play", () => {
    for (const [s, card, side] of [
      [lioPlay, "c1", "lio"],
      [saeAnswer, "c21", "sae"],
    ] as const) {
      const events = s.events.filter((e) => e.kind !== "triggerFired");
      expect(() => check(rules, { ...s, events })).toThrow(
        new RegExp(`${card}'s cardPlayed trigger did not fire for a play by ${side}, though its filter`),
      );
    }
  });
});

describe("once triggers", () => {
  // c1 fires once, on LIO's first play; c21 once, on SAE's first play only (filtered and once).
  const rules = rulesOf("once-triggers", {
    c1: [trigger("cardPlayed", "once", undefined, true)],
    c21: [trigger("cardPlayed", "onceForSae", { op: "playedBy", side: "sae" }, true)],
  });
  const steps = stepsOf(rules, 2);
  const all = steps.flatMap((s) => s.events);

  it("each fires exactly once, then is gone from the triggers, and no triggerEnded names it", () => {
    expect(fired(all)).toEqual(["c1", "c21"]);
    expect(stepFiring(steps, "c1").after.public.triggers.map((t) => t.source)).not.toContain("c1");
    expect(stepFiring(steps, "c21").after.public.triggers.map((t) => t.source)).not.toContain("c21");
    expect(all.filter((e) => e.kind === "triggerEnded")).toEqual([]);
    expect(check(rules, stepFiring(steps, "c1"))).toMatchObject({ onceFired: 1 });
  });
  it("fails a once trigger firing twice, at a later play", () => {
    const lioPlays = steps.filter((s) =>
      s.before.public.pending.some((d) => d.kind === "playCardAs" && d.side === "lio"),
    );
    const [first, second] = [lioPlays[0]!, lioPlays[1]!];
    expect(fired(first.events)).toEqual(["c1"]);
    expect(fired(second.events)).toEqual([]);
    const events = [...second.events, firedEvent("c1")];
    expect(() => check(rules, { ...second, events })).toThrow(
      /c1's cardPlayed trigger fired for a play by lio more often/,
    );
  });
  it("fails a once trigger that stays in the triggers after it fires", () => {
    const s = stepFiring(steps, "c1");
    const kept = s.before.public.triggers.find((t) => t.source === "c1")!;
    const after = { ...s.after, public: { ...s.after.public, triggers: [kept, ...s.after.public.triggers] } };
    expect(() => check(rules, { ...s, after })).toThrow(/after the step the triggers are/);
  });
  it("fails a triggerEnded naming a once trigger that already fired", () => {
    const last = steps.at(-1)!;
    const events: GameEvent[] = [
      ...last.events,
      { kind: "triggerEnded", visibility: "public", source: "c1", hook: "cardPlayed" },
    ];
    expect(() => check(rules, { ...last, events })).toThrow(
      /triggerEnded names c1's cardPlayed trigger, but none is waiting/,
    );
  });
});

describe("has filters", () => {
  // LIO's c2 sets the lasting marker m. c1 waits on m at cardPlayed and at turnEnd; c21 on n, which no played card sets.
  const rules = rulesOf("has-filters", {
    c1: [
      trigger("cardPlayed", "hasM", { op: "has", marker: "m" }),
      trigger("turnEnd", "hasMAtEnd", { op: "has", marker: "m" }),
    ],
    c21: [trigger("turnEnd", "hasN", { op: "has", marker: "n" })],
    c2: [marker("m", true)],
    c40: [marker("n", true)],
  });
  const steps = stepsOf(rules, 1);

  it("a cardPlayed trigger fires once the played card's own event set its marker", () => {
    const s = stepFiring(steps, "c1");
    const at = (pred: (e: GameEvent) => boolean) => s.events.findIndex(pred);
    expect(s.before.public.markers).toEqual([]);
    expect(at((e) => e.kind === "marker" && e.label === "m")).toBeLessThan(at((e) => e.kind === "triggerFired"));
    expect(check(rules, s)).toMatchObject({ filteredFired: 1 });
  });
  it("fails a has filter whose marker was set only after its trigger fired", () => {
    const s = stepFiring(steps, "c1");
    const m = s.events.find((e) => e.kind === "marker" && e.label === "m")!;
    const events = [...s.events.filter((e) => e !== m), m];
    expect(() => check(rules, { ...s, events })).toThrow(
      /c1's cardPlayed trigger fired for a play by lio though its filter/,
    );
  });
  it("at the turn's end, the trigger whose marker is set fires and the other ends, and swapping them fails", () => {
    const s = stepFiring(steps, "c1", "turnEnd");
    // SAE's last play fires c1's cardPlayed trigger, then the turn ends, ending it, all in the same step.
    const lifecycle = s.events.filter((e) => e.kind === "triggerFired" || e.kind === "triggerEnded");
    expect(lifecycle.map((e) => `${e.kind}:${e.source}:${e.hook}`)).toEqual([
      "triggerFired:c1:cardPlayed",
      "triggerEnded:c21:turnEnd",
      "triggerFired:c1:turnEnd",
      "triggerEnded:c1:cardPlayed",
    ]);
    expect(check(rules, s)).toMatchObject({ filteredFired: 2, filteredSkipped: 1 });
    const swapped = s.events.map((e): GameEvent => {
      if (e.kind === "triggerEnded" && e.hook === "turnEnd") return { ...e, source: "c1" };
      return e.kind === "triggerFired" && e.hook === "turnEnd" ? { ...e, source: "c21" } : e;
    });
    expect(() => check(rules, { ...s, events: swapped })).toThrow(/at the turnEnd hook, by their filters/);
  });
});
