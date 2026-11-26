// #602 follow-up: Resilient institutions through each real draw, not only drawContingency called directly
// (resilientInstitutions.test.ts). A 1 from LIO's own deck is set aside and LIO draws again, whether the draw is
// for an intervention, a realignment (LIO's or LIO's defending draw in SAE's), a tech race attempt or a card's
// drawContingency step in the event of a card LIO played (resilientCardDraws.test.ts has the card-event rule).
// Built on the test map (test/map.ts); LIO's deck is set so its next draws are 1 then 4.
import { describe, expect, it } from "vitest";
import type { AnswerValue, CountryId, GameEvent, GameState, Side, Step } from "./index.ts";
import { realignBonus } from "./realign.ts";
import { startProgram } from "./stack.ts";
import { applied, marker, markers, playAnswer, ruleset, startWith } from "./test/game.ts";
import { spend } from "./test/mapGame.ts";
import { drawn, drawsNext, game, redraws } from "./test/redraw.ts";
import { raceRules, raceSetup } from "./test/techRace.ts";

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue) {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

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

  it("a drawContingency step in the event of LIO's own card binds the second draw", () => {
    const steps: Step[] = [{ op: "drawContingency", side: "lio", bind: "n" }, marker("drew", "n")];
    const r = startProgram(ruleset, game(), steps, "l1", "lio");
    if (!r.ok) throw new Error(r.error.code);
    const done = r.value;
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([LIO_REDRAW]);
    expect(markers(done.events)).toEqual(["drew:4"]);
    expect(used(done.state)).toMatchObject({ used: 1 });
  });
});
