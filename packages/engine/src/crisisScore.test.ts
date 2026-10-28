// R22: a crisis moves the score track (docs/design/map-and-points.md, "Crisis at 6" and "Scoring"). The side that
// caused the crisis loses the drawn number of points: the track moves that far towards the rival, stops at its end,
// and reaching the rival's end wins the game for the rival at once. A map without scoring has no track to move.
import { describe, expect, it } from "vitest";
import type { GameEvent, GameState, MapScoring, Ruleset, Setup, Side, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { placeAll } from "./test/placing.ts";
import { applied, openWith, orderAnswer, playAnswer, setupPlus, sideCard, startGame, withCards } from "./test/game.ts";
import { testMap } from "./test/map.ts";

const SCORING: MapScoring = {
  track: { end: 10, start: 0 },
  regions: testMap().regions.map((r) => ({ region: r.id, present: 1, ahead: 2, all: 3 })),
};
const escalate = (by: number): Step => ({ op: "escalate", by });
const raise = escalate(1);
/** A step that would show the program ran on: it lowers Escalation by 1. */
const lower = escalate(-1);

const setupFor = (extra: { lio?: string[]; sae?: string[] }, scoring = true): Setup => ({
  ...setupPlus(extra, 2, 1),
  firstEra: "era-1",
  map: scoring ? { ...testMap(), scoring: SCORING } : testMap(),
});

/** `state` with Escalation at `escalation` and, when given, the score track at `score`: a fresh copy. */
const at = (state: GameState, escalation: number, score?: number): GameState => ({
  ...state,
  public: { ...state.public, escalation, ...(score === undefined ? {} : { score }) },
});

const scoreChanges = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "scoreChanged");
const order = (events: readonly GameEvent[]) =>
  events.filter((e) => ["escalationChanged", "escalationCrisis", "scoreChanged"].includes(e.kind)).map((e) => e.kind);

/** `state` with `value` moved to the top of `side`'s Contingency deck: the same cards, so `left` stays right. */
function onTop(state: GameState, side: Side, value: number): GameState {
  const deck = state.secret.contingency[side];
  const rest = [...deck];
  rest.splice(rest.indexOf(value), 1);
  return {
    ...state,
    secret: { ...state.secret, contingency: { ...state.secret.contingency, [side]: [value, ...rest] } },
  };
}

/**
 * `causer` plays its own card c9 (effect `effect`) for its event, with Escalation at 5, the track at `score` and,
 * when given, `top` the next card of its Contingency deck.
 */
function crisisBy(causer: Side, effect: Step[], score?: number, scoring = true, top?: number) {
  const id = causer === "lio" ? "l9" : "s9";
  const rs: Ruleset = withCards(sideCard(id, 2, effect));
  const opened = openWith(startGame(2, 1, rs, setupFor({ [causer]: [id] }, scoring)), "l1", "s1", rs).state;
  const before =
    causer === "lio" ? opened : placeAll(applied(opened, playAnswer(opened, "lio", "l2", "points"), rs), rs).state;
  const placed = at(before, 5, score);
  const start = top === undefined ? placed : onTop(placed, causer, top);
  const drawn = start.secret.contingency[causer][0]!;
  return { rs, before: start, drawn, after: applied(start, playAnswer(start, causer, id, "event"), rs) };
}

describe("a crisis on a map with scoring", () => {
  it("one LIO caused moves the track towards SAE by the number LIO drew", () => {
    const { drawn, after } = crisisBy("lio", [raise]);
    expect(after.state.public.score).toBe(drawn);
    expect(scoreChanges(after.events)).toEqual([{ kind: "scoreChanged", visibility: "public", from: 0, to: drawn }]);
  });

  it("one SAE caused moves the track towards LIO by the number SAE drew", () => {
    const { drawn, after } = crisisBy("sae", [raise], 2);
    expect(after.state.public.score).toBe(2 - drawn);
    expect(scoreChanges(after.events)).toEqual([
      { kind: "scoreChanged", visibility: "public", from: 2, to: 2 - drawn },
    ]);
  });

  it("the track moves after the crisis is announced and before Escalation drops back to 3", () => {
    const { after } = crisisBy("lio", [raise]);
    expect(order(after.events).slice(0, 4)).toEqual([
      "escalationChanged",
      "escalationCrisis",
      "scoreChanged",
      "escalationChanged",
    ]);
    expect(after.state.public.escalation).toBe(3);
  });

  it("a crisis that does not reach an end lets the game and the card's program go on", () => {
    const { after } = crisisBy("lio", [raise, lower]);
    expect(after.state.public.status).toEqual({ kind: "active" });
    expect(after.state.public.escalation).toBe(2); // dropped to 3, then the next step lowered it
  });

  it("the track stops at the rival's end, and the rival wins at once (trackEnd)", () => {
    const { drawn, after } = crisisBy("sae", [raise], -9, true, 4);
    expect(drawn).toBe(4); // -9 - 4 would pass the end: the stop is what holds the track at -10
    expect(after.state.public.score).toBe(-10);
    expect(scoreChanges(after.events)).toEqual([{ kind: "scoreChanged", visibility: "public", from: -9, to: -10 }]);
    expect(after.state.public.status).toEqual({ kind: "over", winner: "lio", reason: "trackEnd" });
    expect(after.state.public.pending).toEqual([]);
    expect(after.state.public.stack).toEqual([]);
  });

  it("a crisis that ends the game leaves Escalation at 6: the track move is its last event", () => {
    const { after } = crisisBy("sae", [raise], -9);
    expect(order(after.events)).toEqual(["escalationChanged", "escalationCrisis", "scoreChanged"]);
    expect(after.state.public.escalation).toBe(6);
  });

  it("reaching SAE's end ends the game for SAE when LIO caused the crisis", () => {
    const { drawn, after } = crisisBy("lio", [raise], 9, true, 4);
    expect(drawn).toBe(4); // 9 + 4 would pass the end
    expect(after.state.public.score).toBe(10);
    expect(after.state.public.status).toEqual({ kind: "over", winner: "sae", reason: "trackEnd" });
  });

  it("a crisis that ends the game stops the rest of the card's program", () => {
    const { after } = crisisBy("lio", [raise, lower], 9);
    const lowered = after.events.filter((e) => e.kind === "escalationChanged" && e.to < e.from);
    expect(lowered).toEqual([]);
    expect(after.state.public.status.kind).toBe("over");
  });

  it("apply never mutates its input when a crisis moves the track (frozen input)", () => {
    const { rs, before } = crisisBy("lio", [raise], 9);
    const frozen = deepFreeze(before);
    const after = applied(frozen, playAnswer(frozen, "lio", "l9", "event"), rs);
    expect(frozen.public.score).toBe(9);
    expect(frozen.public.status).toEqual({ kind: "active" });
    expect(after.state.public.status.kind).toBe("over");
  });
});

describe("a crisis on a map without scoring", () => {
  it("draws the card as before but has no track to move, and the game goes on", () => {
    const { after } = crisisBy("lio", [raise], undefined, false);
    expect("score" in after.state.public).toBe(false);
    expect(scoreChanges(after.events)).toEqual([]);
    expect(after.events.some((e) => e.kind === "escalationCrisis")).toBe(true);
    expect(after.state.public.status).toEqual({ kind: "active" });
  });
});

describe("a rival's card played for points", () => {
  it("still costs the player who played it: SAE playing LIO's card moves the track towards LIO", () => {
    const rs = withCards(sideCard("l9", 2, [raise]));
    const opened = openWith(startGame(2, 1, rs, setupFor({ sae: ["l9"] })), "l1", "s1", rs).state;
    const s = at(placeAll(applied(opened, playAnswer(opened, "lio", "l2", "points"), rs), rs).state, 5);
    const drawn = s.secret.contingency.sae[0]!;
    const waiting = applied(s, playAnswer(s, "sae", "l9", "points"), rs).state;
    const r = placeAll(applied(waiting, orderAnswer(waiting, "sae", "before"), rs), rs);
    expect(r.state.public.score).toBe(-drawn);
  });
});
