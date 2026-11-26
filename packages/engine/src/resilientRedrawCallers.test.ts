// #602 follow-up: Resilient institutions through each real draw, not only drawContingency called directly
// (resilientInstitutions.test.ts). A 1 from LIO's own deck is set aside and LIO draws again, whether the draw is
// for an intervention, a realignment (LIO's or LIO's defending draw in SAE's), a tech race attempt or a card's
// drawContingency step. Built on the test map (test/map.ts); LIO's deck is set so its next draws are 1 then 4.
import { describe, expect, it } from "vitest";
import type { AnswerValue, CountryId, GameEvent, GameState, Ruleset, Setup, Side, Step } from "./index.ts";
import { realignBonus } from "./realign.ts";
import { startProgram } from "./stack.ts";
import { applied, marker, markers, playAnswer, playAnswers, ruleset, startGame, startWith } from "./test/game.ts";
import { mapSetup } from "./test/map.ts";
import { spend } from "./test/mapGame.ts";
import { raceRules, raceSetup } from "./test/techRace.ts";

const ABILITIES: NonNullable<Setup["abilities"]> = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "unifiedCommand", bonus: 1 },
};

/** `state` with `side`'s next draws being `values`, in that order (the deck keeps the same cards). */
function drawsNext(state: GameState, side: Side, values: number[]): GameState {
  const rest = [...state.secret.contingency[side]];
  for (const v of values) {
    const at = rest.indexOf(v);
    if (at < 0) throw new Error(`${side}'s deck has no ${v} left`);
    rest.splice(at, 1);
  }
  const contingency = { ...state.secret.contingency, [side]: [...values, ...rest] };
  return { ...state, secret: { ...state.secret, contingency } };
}

/** A game with both abilities at LIO's first play, LIO's next draws being 1 then 4. */
function game(setup: Setup = mapSetup(), rs: Ruleset = ruleset): GameState {
  const start = playAnswers(startGame(2, 1, rs, { ...setup, abilities: ABILITIES }), 2, rs);
  return drawsNext(start, "lio", [1, 4]);
}

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue) {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

const drawn = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [`${e.deck}:${e.value}`] : []));
const redraws = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "abilityRedraw");
const ofKind = <K extends GameEvent["kind"]>(events: readonly GameEvent[], kind: K) =>
  events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);
const used = (state: GameState) => state.public.abilities!.lio;

const LIO_REDRAW = { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "lio", setAside: 1 };

/** `side` spends 1 point, picks realign on the action menu and realigns once in `country`. */
function realignOnce(start: GameState, side: Side, country: CountryId) {
  const asked = startWith([spend(side, 1)], ruleset, start);
  const menu = applied(asked.state, answer(asked.state, { kind: "chooseAction", action: "realign" }));
  return applied(menu.state, answer(menu.state, { kind: "realign", country }));
}

describe("Resilient institutions through the real draws", () => {
  it("an intervention by LIO uses the second draw", () => {
    // LIO intervenes in echo (stability 1, SAE 3) with 2 points: 4 + 2 - 2 = 4, where the 1 would have given 1.
    const asked = startWith([spend("lio", 2)], ruleset, game()).state;
    const done = applied(asked, answer(asked, { kind: "chooseAction", action: "intervene", country: "echo" }));
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    expect(ofKind(done.events, "intervened")).toMatchObject([{ side: "lio", draw: 4, result: 4 }]);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });

  it("a realignment by LIO uses LIO's second draw; SAE's draw comes after", () => {
    const start = drawsNext(game(), "sae", [2]);
    const done = realignOnce(start, "lio", "charlie");
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4", "sae:2"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    const lio = 4 + realignBonus(start.public, "lio", "charlie");
    const sae = 2 + realignBonus(start.public, "sae", "charlie");
    expect(ofKind(done.events, "realigned")).toMatchObject([{ side: "lio", totals: { lio, sae } }]);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });

  it("in SAE's realignment, LIO's defending draw is redrawn too, and SAE's own 1 stands", () => {
    const start = drawsNext(game(), "sae", [1]);
    const done = realignOnce(start, "sae", "charlie");
    expect(drawn(done.events)).toEqual(["sae:1", "lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    const lio = 4 + realignBonus(start.public, "lio", "charlie");
    const sae = 1 + realignBonus(start.public, "sae", "charlie");
    expect(ofKind(done.events, "realigned")).toMatchObject([{ side: "sae", totals: { lio, sae } }]);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });

  it("a tech race attempt uses the second draw: 4 moves the marker where the 1 would not", () => {
    const start = game(raceSetup(), raceRules);
    const asked = applied(start, playAnswer(start, "lio", "l2", "points"), raceRules).state;
    const done = applied(asked, answer(asked, { kind: "chooseAction", action: "techRace" }), raceRules);
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    expect(ofKind(done.events, "techRaceAttempted")).toMatchObject([{ side: "lio", draw: 4, from: 0, to: -1 }]);
    expect(done.state.public.techRace!.marker).toBe(-1);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });

  it("a card's drawContingency step binds the second draw", () => {
    const steps: Step[] = [{ op: "drawContingency", side: "lio", bind: "n" }, marker("drew", "n")];
    const done = startWith(steps, ruleset, game());
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    expect(markers(done.events)).toEqual(["drew:4"]);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });

  it("a card step whose draw goes to the World deck is not redrawn: the World deck has no owner", () => {
    // SAE runs LIO's card, so its draws from LIO's deck come from the World deck (every card a 1 here).
    const setup = { ...mapSetup(), contingency: { ...mapSetup().contingency, world: [1, 1, 1, 1, 1, 1] } };
    const steps: Step[] = [{ op: "drawContingency", side: "lio", bind: "n" }, marker("drew", "n")];
    const r = startProgram(ruleset, game(setup), steps, "l1", "sae", "lio");
    if (!r.ok) throw new Error(r.error.code);
    expect(drawn(r.value.events)).toEqual(["world:1"]);
    expect(redraws(r.value.events)).toEqual([]);
    expect(markers(r.value.events)).toEqual(["drew:1"]);
    expect(used(r.value.state)).toMatchObject({ used: 0 });
  });
});
