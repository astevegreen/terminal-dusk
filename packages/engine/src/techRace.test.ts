// R25 (#462): the tech race action (docs/design/tech-race.md, "Making an attempt" and "First there"). One shared
// marker, negative for LIO's lead and positive for SAE's. A card played for its points may make one attempt a turn:
// it must carry the next move's cost, and a draw of 4 or more from the side's own deck moves the marker one step.
// Built on the test map (test/map.ts) with the doc's track (test/techRace.ts).
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./index.ts";
import type { GameEvent, GameState, Side } from "./index.ts";
import { applied, orderAnswer, playAnswer, playAnswers, startWith } from "./test/game.ts";
import { spend } from "./test/mapGame.ts";
import { choose, menu, nextDraw, placeAction, raceGame, withRace, raceRules, techRaceAction } from "./test/techRace.ts";

/** `side`'s play (pending in `state`) of `card` for its points, which opens the action menu. */
const playForPoints = (state: GameState, side: Side, card: string) =>
  applied(state, playAnswer(state, side, card, "points"), raceRules).state;

/** `side` plays `card` for its points and makes a tech race attempt, its draw being `draw`. */
function attempt(state: GameState, side: Side, card: string, draw: number) {
  const asked = playForPoints(nextDraw(state, side, draw), side, card);
  return applied(asked, choose(asked, techRaceAction), raceRules);
}

const raced = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "techRaceAttempted");
const race = (state: GameState) => state.public.techRace!;

describe("the tech race in public state", () => {
  it("starts at parity, with nobody's attempt, step or bonus recorded", () => {
    expect(raceGame().public.techRace).toEqual({ marker: 0, attempted: [], reached: [], bonus: [] });
  });
});

describe("offering the tech race on the action menu", () => {
  it("is the fourth action when a card played for its points carries the next step's cost", () => {
    const asked = playForPoints(raceGame(), "lio", "l2");
    expect(menu(asked)).toEqual(["place", "intervene", "realign", "techRace"]);
    expect(legalAnswers(raceRules, asked, "lio")).toContainEqual(techRaceAction);
  });

  it("is not offered when the card's points are below the move's cost", () => {
    // At LIO's AI (-2), moving on to Hypersonics costs 3; l3 carries 2.
    expect(menu(playForPoints(raceGame({ marker: -2 }), "lio", "l3"))).not.toContain("techRace");
    // Pulling SAE back from AI (+2) costs what AI cost, 2.
    expect(menu(playForPoints(raceGame({ marker: 2 }), "lio", "l3"))).toContain("techRace");
  });

  it("is not offered to a side at its own end, but its rival can still pull the marker back", () => {
    expect(menu(playForPoints(raceGame({ marker: -4 }), "lio", "l2"))).not.toContain("techRace");
    expect(menu(playForPoints(raceGame({ marker: 4 }), "lio", "l2"))).toContain("techRace");
  });

  it("is never offered for event points, only for a card played for its points", () => {
    const { state } = startWith([spend("lio", 4)], raceRules, raceGame());
    expect(menu(state)).not.toContain("techRace");
  });

  it("is not offered to a side that has already made its attempt this turn", () => {
    expect(menu(playForPoints(raceGame({ attempted: ["lio"] }), "lio", "l2"))).not.toContain("techRace");
  });

  it("is offered for a 1-point card at parity, since Networks and Orbit costs 1", () => {
    const asked = playForPoints(raceGame(), "lio", "l4");
    expect(menu(asked)).toContain("techRace");
  });
});

describe("making an attempt", () => {
  it("draws from the side's own deck and on 4 or more moves the marker one step its way", () => {
    const { state, events } = attempt(raceGame(), "lio", "l2", 4);
    expect(events).toContainEqual({ kind: "contingencyDrawn", visibility: "public", deck: "lio", value: 4 });
    expect(raced(events)).toEqual([
      {
        kind: "techRaceAttempted",
        visibility: "public",
        side: "lio",
        points: 4,
        cost: 1,
        draw: 4,
        bonus: 0,
        from: 0,
        to: -1,
        first: true,
      },
    ]);
    expect(race(state).marker).toBe(-1);
  });

  it("on 3 or less leaves the marker where it is, and the points above the cost are lost either way", () => {
    const { state, events } = attempt(raceGame({ marker: 1 }), "lio", "l2", 3);
    expect(raced(events)).toMatchObject([{ side: "lio", points: 4, cost: 1, draw: 3, from: 1, to: 1 }]);
    expect(race(state).marker).toBe(1);
    expect(state.public.pending[0]).toMatchObject({ side: "sae", kind: "playCardAs" });
  });

  it("pulling the rival back costs what the rival's step cost", () => {
    const { state, events } = attempt(raceGame({ marker: 3, reached: [1, 2, 3] }), "lio", "l2", 5);
    expect(raced(events)).toMatchObject([{ cost: 3, from: 3, to: 2, first: false }]);
    expect(race(state).marker).toBe(2);
  });

  it("allows one attempt per side per turn, whatever its result, and a new turn allows another", () => {
    const first = attempt(raceGame({}, 2, 2), "lio", "l2", 1).state;
    expect(race(first).attempted).toEqual(["lio"]);
    const saeAsked = playForPoints(first, "sae", "s2");
    expect(menu(saeAsked)).toContain("techRace");
    const sae = applied(nextDraw(saeAsked, "sae", 1), choose(saeAsked, techRaceAction), raceRules).state;
    expect(race(sae).attempted).toEqual(["lio", "sae"]);
    expect(menu(playForPoints(sae, "lio", "l3"))).not.toContain("techRace");
  });

  it("is offered again once the next turn opens, with the marker kept where it was", () => {
    const lio = attempt(raceGame({}, 2, 1), "lio", "l2", 4).state;
    const sae = attempt(lio, "sae", "s2", 1).state;
    const turn2 = playAnswers(sae, 2, raceRules);
    expect(turn2.public.turn).toBe(2);
    expect(race(turn2)).toMatchObject({ marker: -1, attempted: [] });
    // LIO's turn-2 hand: AI costs 2, so it plays s9 (SAE's 4-point card) for its points, its event after.
    const asked = playForPoints(turn2, "lio", "s9");
    expect(menu(applied(asked, orderAnswer(asked, "lio", "after"), raceRules).state)).toContain("techRace");
  });
});

describe("a rival's card spent on the tech race", () => {
  it("has no event, and a once-only card stays in the game", () => {
    const asked = playForPoints(raceGame(), "lio", "s9");
    const ordered = applied(nextDraw(asked, "lio", 2), orderAnswer(asked, "lio", "after"), raceRules).state;
    expect(menu(ordered)).toContain("techRace");
    const { state, events } = applied(ordered, choose(ordered, techRaceAction), raceRules);
    expect(events.some((e) => e.kind === "marker" && e.label === "s9-event")).toBe(false);
    expect(state.public.discard).toContain("s9");
    expect(state.public.removed).not.toContain("s9");
  });

  it("still has its event when its points go to another action", () => {
    const asked = playForPoints(raceGame(), "lio", "s9");
    const ordered = applied(asked, orderAnswer(asked, "lio", "after"), raceRules).state;
    let { state, events } = applied(ordered, choose(ordered, placeAction), raceRules);
    const all = [...events];
    while (state.public.pending[0]?.kind === "placeInfluence") {
      const d = state.public.pending[0];
      ({ state, events } = applied(
        state,
        { decisionId: d.id, side: d.side, value: legalAnswers(raceRules, state, d.side)[0]! },
        raceRules,
      ));
      all.push(...events);
    }
    expect(all.some((e) => e.kind === "marker" && e.label === "s9-event")).toBe(true);
    expect(state.public.removed).toContain("s9");
  });

  it("is not offered when the event already happened before the points", () => {
    const asked = playForPoints(raceGame(), "lio", "s9");
    const { state, events } = applied(asked, orderAnswer(asked, "lio", "before"), raceRules);
    expect(events.some((e) => e.kind === "marker" && e.label === "s9-event")).toBe(true);
    expect(menu(state)).not.toContain("techRace");
  });
});

describe("first there (+1 on the next draw)", () => {
  it("the first side to reach a step draws +1 on its very next attempt, which then uses it up", () => {
    const first = attempt(raceGame({}, 2, 2), "lio", "l2", 4).state;
    expect(race(first)).toMatchObject({ marker: -1, reached: [1], bonus: ["lio"] });
    // SAE's failed attempt in between, then LIO's next attempt as if in a new turn: 3 + 1 succeeds.
    const sae = attempt(first, "sae", "s2", 1).state;
    const next = attempt(withRace(sae, { attempted: [] }), "lio", "l3", 3);
    expect(raced(next.events)).toMatchObject([{ draw: 3, bonus: 1, from: -1, to: -2, first: true }]);
    expect(race(next.state)).toMatchObject({ reached: [1, 2], bonus: ["lio"] });
  });

  it("gives nothing to a side reaching a step the rival reached first", () => {
    const { state, events } = attempt(raceGame({ reached: [1] }), "lio", "l2", 4);
    expect(raced(events)).toMatchObject([{ to: -1, first: false }]);
    expect(race(state).bonus).toEqual([]);
  });

  it("counts on a pull-back too, and is used up even when the attempt fails", () => {
    const { state, events } = attempt(raceGame({ marker: 2, reached: [1, 2], bonus: ["lio"] }), "lio", "l2", 1);
    expect(raced(events)).toMatchObject([{ draw: 1, bonus: 1, from: 2, to: 2 }]);
    expect(race(state).bonus).toEqual([]);
  });
});
