// R16a (#315): points spent on placing influence (docs/design/map-and-points.md, "Influence", "Points and actions",
// "Event points"). Reach is fixed when the play starts, each influence costs 1 or 2 by control at that moment,
// and every point is spent while a placement is affordable (owner, 26 Oct, #315 option a). Built on the test map
// (test/map.ts): LIO's home box touches alpha, SAE's echo and delta.
import { describe, expect, it } from "vitest";
import { apply, legalAnswers } from "./index.ts";
import type { CountryId, GameEvent, GameState, Side, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  accepted,
  applied,
  playAnswer,
  playAnswers,
  ruleset,
  sideCard,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";
import { mapSetup } from "./test/map.ts";

const spend = (side: Side, amount: number): Step => ({ op: "spendPoints", side, amount });

/** A map game at LIO's first play, with influence set from `counts` (0 where none is given), or the map's start. */
function mapGame(counts?: Record<CountryId, { lio?: number; sae?: number }>): GameState {
  const state = playAnswers(startGame(2, 1, ruleset, mapSetup()), 2);
  if (counts === undefined) return state;
  const influence = state.public.influence!.map(({ country }) => ({
    country,
    lio: counts[country]?.lio ?? 0,
    sae: counts[country]?.sae ?? 0,
  }));
  return { ...state, public: { ...state.public, influence } };
}

const countOf = (state: GameState, country: CountryId, side: Side): number =>
  state.public.influence!.find((e) => e.country === country)![side];

/** The answer placing in `country` for the placing `state` has open. */
function place(state: GameState, country: CountryId) {
  const d = state.public.pending[0];
  if (d?.kind !== "placeInfluence") throw new Error(`no placing pending: ${JSON.stringify(state.public.pending)}`);
  return { decisionId: d.id, side: d.side, value: { kind: "placeInfluence" as const, country } };
}

const legalCountries = (state: GameState, side: Side): string[] =>
  legalAnswers(ruleset, state, side).map((a) => (a.kind === "placeInfluence" ? a.country : `not a placing: ${a.kind}`));

const placed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.kind === "influencePlaced" ? [`${e.side}:${e.country}:${e.cost}`] : []));

describe("spendPoints places influence (R16a)", () => {
  it("asks its side to place, with the points to spend and the countries it can reach, in the map's order", () => {
    // LIO has 2 in alpha and 1 in charlie: alpha, bravo, charlie and delta (next to charlie) are in reach.
    const { state, events } = startWith([spend("lio", 2)], ruleset, mapGame());
    expect(events).toEqual([{ kind: "pointsSpent", visibility: "public", side: "lio", amount: 2 }]);
    expect(state.public.pending).toEqual([
      {
        id: expect.any(String),
        side: "lio",
        kind: "placeInfluence",
        options: { points: 2, countries: ["alpha", "bravo", "charlie", "delta"] },
      },
    ]);
    expect(legalCountries(state, "lio")).toEqual(["alpha", "bravo", "charlie", "delta"]);
    expect(legalAnswers(ruleset, state, "sae")).toEqual([]);
  });

  it("each placement adds 1 influence for 1 point, and the side is asked again until its points are spent", () => {
    const first = startWith([spend("lio", 2)], ruleset, mapGame()).state;
    const second = applied(first, place(first, "alpha"));
    expect(placed(second.events)).toEqual(["lio:alpha:1"]);
    expect(second.state.public.pending[0]).toMatchObject({ kind: "placeInfluence", options: { points: 1 } });
    const done = applied(second.state, place(second.state, "bravo"));
    expect(placed(done.events)).toEqual(["lio:bravo:1"]);
    expect(countOf(done.state, "alpha", "lio")).toBe(3);
    expect(countOf(done.state, "bravo", "lio")).toBe(1);
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.some((d) => d.kind === "placeInfluence")).toBe(false);
  });

  it("may place more than once in the same country", () => {
    let state = startWith([spend("lio", 3)], ruleset, mapGame()).state;
    for (let i = 0; i < 3; i++) state = accepted(state, place(state, "bravo"));
    expect(countOf(state, "bravo", "lio")).toBe(3);
  });

  it("reach is fixed when the play starts: influence placed earlier in the play does not open up its neighbours", () => {
    // LIO has only 2 in alpha: alpha, bravo and charlie are in reach, delta (next to charlie) is not.
    const start = startWith([spend("lio", 2)], ruleset, mapGame({ alpha: { lio: 2 }, echo: { sae: 3 } })).state;
    expect(legalCountries(start, "lio")).toEqual(["alpha", "bravo", "charlie"]);
    const next = accepted(start, place(start, "charlie"));
    expect(countOf(next, "charlie", "lio")).toBe(1);
    expect(next.public.pending[0]).toMatchObject({ options: { points: 1, countries: ["alpha", "bravo", "charlie"] } });
    expect(legalCountries(next, "lio")).not.toContain("delta");
    const refused = apply(ruleset, next, place(next, "delta"));
    expect(refused.ok ? "accepted" : refused.error.code).toBe("illegalAnswer");
  });

  it("a country outside the side's reach, or not on the map, is refused as illegal", () => {
    const start = startWith([spend("lio", 2)], ruleset, mapGame()).state;
    for (const country of ["echo", "foxtrot", "nowhere"]) {
      const r = apply(ruleset, start, place(start, country));
      expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
    }
  });

  it("costs 2 points in a country the rival controls", () => {
    // SAE controls bravo (stability 1) with 1 influence there.
    const start = startWith([spend("lio", 2)], ruleset, mapGame({ alpha: { lio: 2 }, bravo: { sae: 1 } })).state;
    const done = applied(start, place(start, "bravo"));
    expect(placed(done.events)).toEqual(["lio:bravo:2"]);
    expect(done.state.public.stack).toEqual([]);
  });

  it("the cost follows control at each placement: once the rival's control is broken, the next one costs 1", () => {
    // LIO has no influence: only alpha (next to its home box) is in reach, and SAE controls it with 2 (stability 2).
    const start = startWith([spend("lio", 3)], ruleset, mapGame({ alpha: { sae: 2 } })).state;
    expect(legalCountries(start, "lio")).toEqual(["alpha"]);
    const second = applied(start, place(start, "alpha"));
    expect(placed(second.events)).toEqual(["lio:alpha:2"]);
    expect(second.state.public.pending[0]).toMatchObject({ options: { points: 1 } });
    const done = applied(second.state, place(second.state, "alpha"));
    expect(placed(done.events)).toEqual(["lio:alpha:1"]);
    expect(countOf(done.state, "alpha", "lio")).toBe(2);
  });

  it("every point is spent while a placement is affordable: the side is offered no way to stop early", () => {
    const start = startWith([spend("lio", 2)], ruleset, mapGame()).state;
    const answers = legalAnswers(ruleset, start, "lio");
    expect(answers.length).toBeGreaterThan(0);
    expect(answers.every((a) => a.kind === "placeInfluence")).toBe(true);
  });

  it("a point left that no reachable country can be bought with is lost, and the play ends", () => {
    // SAE controls alpha with 4: after one placement (2 points) it still controls it, and 1 point cannot buy 2.
    const start = startWith([spend("lio", 3)], ruleset, mapGame({ alpha: { sae: 4 } })).state;
    const done = applied(start, place(start, "alpha"));
    expect(countOf(done.state, "alpha", "lio")).toBe(1);
    expect(done.state.public.stack).toEqual([]);
    expect(done.state.public.pending.some((d) => d.kind === "placeInfluence")).toBe(false);
  });

  it("with nothing affordable from the start, nobody is asked and the program runs on", () => {
    const { state, events } = startWith(
      [spend("lio", 1), { op: "marker", label: "after" }],
      ruleset,
      mapGame({ alpha: { sae: 2 } }),
    );
    expect(events.map((e) => e.kind)).toEqual(["pointsSpent", "marker"]);
    expect(state.public.stack).toEqual([]);
  });

  it("in a game without a map, spending points places nothing and asks nobody", () => {
    const { state, events } = startWith([spend("lio", 2), { op: "marker", label: "after" }]);
    expect(events.map((e) => e.kind)).toEqual(["pointsSpent", "marker"]);
    expect(state.public.stack).toEqual([]);
    expect("influence" in state.public).toBe(false);
  });

  it("an event giving both sides points asks each side in turn, LIO's placing then SAE's", () => {
    const first = startWith([spend("lio", 1), spend("sae", 1)], ruleset, mapGame()).state;
    expect(first.public.pending[0]).toMatchObject({ side: "lio", kind: "placeInfluence", options: { points: 1 } });
    const second = accepted(first, place(first, "alpha"));
    expect(second.public.pending[0]).toMatchObject({
      side: "sae",
      kind: "placeInfluence",
      options: { points: 1, countries: ["alpha", "bravo", "charlie", "delta", "echo"] },
    });
    const done = accepted(second, place(second, "echo"));
    expect(countOf(done, "echo", "sae")).toBe(4);
    expect(done.public.stack).toEqual([]);
  });

  it("never changes the state it is given (frozen input)", () => {
    const start = deepFreeze(startWith([spend("lio", 2)], ruleset, mapGame()).state);
    const next = accepted(start, place(start, "alpha"));
    expect(countOf(start, "alpha", "lio")).toBe(2);
    expect(countOf(next, "alpha", "lio")).toBe(3);
  });
});

describe("a card played for its points places influence (R16a)", () => {
  it("asks the player to place the card's ops, then the game moves on to the next play", () => {
    const rs = withCards(sideCard("l3", 2));
    const atPlay = playAnswers(startGame(2, 1, rs, mapSetup()), 2, rs);
    const asked = applied(atPlay, playAnswer(atPlay, "lio", "l3", "points"), rs);
    expect(asked.events).toContainEqual({ kind: "pointsSpent", visibility: "public", side: "lio", amount: 2 });
    expect(asked.state.public.pending[0]).toMatchObject({
      side: "lio",
      kind: "placeInfluence",
      options: { points: 2 },
    });
    const half = accepted(asked.state, place(asked.state, "alpha"), rs);
    const done = accepted(half, place(half, "delta"), rs);
    expect(countOf(done, "alpha", "lio")).toBe(3);
    expect(countOf(done, "delta", "lio")).toBe(1);
    expect(done.public.pending).toEqual([expect.objectContaining({ side: "sae", kind: "playCardAs" })]);
    expect(done.public.discard).toContain("l3");
  });
});
