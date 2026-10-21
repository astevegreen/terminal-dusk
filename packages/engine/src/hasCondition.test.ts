// The `has` condition (#141): an if is true exactly when a lasting marker with that label has been set.
import { describe, expect, it } from "vitest";
import { hiddenPart, reconstruct, viewFor } from "./views.ts";
import {
  accepted,
  marker,
  markers,
  openWith,
  playAnswer,
  sideCard,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";
import { SIDES } from "./types.ts";
import type { CardId, GameState, Ruleset, Step } from "./types.ts";

const lasting = (label: string): Step => ({ op: "marker", label, lasting: true });
const ifHas = (label: string, then: Step[], otherwise: Step[]): Step => ({
  op: "if",
  cond: { op: "has", marker: label },
  then,
  else: otherwise,
});
/** Card B: if has "x" { marker "yes" } else { marker "no" }. */
const readX: Step[] = [ifHas("x", [marker("yes")], [marker("no")])];

/**
 * A two-turn game: the opening picks of turn 1, a play for points each (l3, s3), then turn 2's opening
 * picks. The markers recorded by turn 2's opening cards.
 */
function turn2Markers(rs: Ruleset, turn1: [CardId, CardId], turn2: [CardId, CardId]): string[] {
  let s: GameState = openWith(startGame(2, 1, rs), turn1[0], turn1[1], rs).state;
  s = accepted(s, playAnswer(s, "lio", "l3", "points"), rs);
  s = accepted(s, playAnswer(s, "sae", "s3", "points"), rs);
  expect(s.public.turn).toBe(2);
  return markers(openWith(s, turn2[0], turn2[1], rs).events);
}

describe("the has condition", () => {
  it("card A sets lasting x on turn 1, so card B on turn 2 records yes", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("x")]), sideCard("s2", 1, readX));
    expect(turn2Markers(rs, ["l1", "s1"], ["l4", "s2"])).toEqual(["yes"]);
  });

  it("in a game where A was never played, B records no", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("x")]), sideCard("s2", 1, readX));
    expect(turn2Markers(rs, ["l2", "s1"], ["l4", "s2"])).toEqual(["no"]);
  });

  it("a marker x set without lasting never makes has x true, not even later in the same event", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("x")]));
    const { state, events } = startWith([marker("x"), ...readX], rs);
    expect(markers(events)).toEqual(["x", "no"]);
    expect(state.public.markers).toEqual([]);
  });

  it("a lasting marker set earlier in the same event makes has true for a later step", () => {
    const { events } = startWith([lasting("x"), ...readX]);
    expect(markers(events)).toEqual(["x", "yes"]);
  });

  it("a lasting marker set by an earlier card in the same turn makes has true for a later card", () => {
    // Both opening cards have 1 op, so LIO's pick, A, resolves first.
    const rs = withCards(sideCard("l1", 1, [lasting("x")]), sideCard("s1", 1, readX));
    expect(markers(openWith(startGame(2, 1, rs), "l1", "s1", rs).events)).toEqual(["x", "yes"]);
  });

  it.each([
    ["an LIO card", "l1", ["l1", "s1"], ["l4", "s2"], "s2"],
    ["an SAE card", "s1", ["l2", "s1"], ["l1", "s2"], "l1"],
    ["a neutral card", "n1", ["n1", "s1"], ["l1", "s2"], "l1"],
  ] as const)("reads a lasting marker set by %s the same way", (_who, setter, turn1, turn2, reader) => {
    const rs = withCards(sideCard(setter, 1, [lasting("x")]), sideCard(reader, 1, readX));
    expect(turn2Markers(rs, [...turn1], [...turn2])).toContain("yes");
  });
});

describe("lasting markers are public", () => {
  it("every view shows them, and a side's view plus its hidden part rebuilds the state", () => {
    const rs = withCards(sideCard("l1", 1, [lasting("x"), lasting("y")]));
    const { state } = openWith(startGame(2, 1, rs), "l1", "s1", rs);
    expect(state.public.markers).toEqual(["x", "y"]);
    expect(viewFor(state, "spectator").public.markers).toEqual(["x", "y"]);
    for (const side of SIDES) {
      expect(viewFor(state, side).public.markers).toEqual(["x", "y"]);
      expect(reconstruct(viewFor(state, side), hiddenPart(state, side))).toEqual(state);
    }
  });
});
