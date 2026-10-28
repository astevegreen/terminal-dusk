// R18a: the escalate step (docs/design/map-and-points.md, "Escalation"). A card's event raises Escalation, caused
// by the player who picked or played the card (even the rival's card), or lowers it. Card checks refuse a `by`
// that is 0 or not whole. In a game without a map the step changes nothing.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { CardDef, GameEvent, GameState, Ruleset, Setup, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { placeAll } from "./test/placing.ts";
import {
  applied,
  choose,
  forEach,
  ifYes,
  makeSetup,
  openWith,
  orderAnswer,
  playAnswer,
  playAnswers,
  ruleset,
  setupPlus,
  sideCard,
  startAtPlay,
  startGame,
  testCard,
  withCards,
} from "./test/game.ts";
import { testMap } from "./test/map.ts";

const escalate = (by: number): Step => ({ op: "escalate", by });
const changed = (from: number, to: number): GameEvent => ({
  kind: "escalationChanged",
  visibility: "public",
  from,
  to,
});
const crisis = (side: Side, value: number): GameEvent => ({
  kind: "escalationCrisis",
  visibility: "public",
  side,
  value,
});
const escalationEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "escalationChanged" || e.kind === "escalationCrisis");

/** setupPlus with `extra` in the hands, and the test map unless `map` is false. */
const setupFor = (extra: { lio?: string[]; sae?: string[] }, map = true, plays = 1): Setup =>
  map ? { ...setupPlus(extra, 2, plays), firstEra: "era-1", map: testMap() } : setupPlus(extra, 2, plays);

/** `state` with Escalation set to `at`, a fresh copy. */
const at = (state: GameState, value: number): GameState => ({
  ...state,
  public: { ...state.public, escalation: value },
});

/** The game opened with l1 and s1 (no events), so LIO's play is open. */
const atLioPlay = (rs: Ruleset, setup: Setup): GameState => openWith(startGame(2, 1, rs, setup), "l1", "s1", rs).state;

/**
 * The state atLioPlay reaches once LIO has played l2 for its points and placed them (placeAll), so SAE's play
 * is open.
 */
function atSaePlay(rs: Ruleset, setup: Setup): GameState {
  const s = atLioPlay(rs, setup);
  return placeAll(applied(s, playAnswer(s, "lio", "l2", "points"), rs), rs).state;
}

/**
 * `side` plays the rival's card `id` for its points, with its event before the points, and places them
 * (placeAll): the events are the event's and the placings', and whatever followed them.
 */
function playRival(state: GameState, side: Side, id: string, rs: Ruleset) {
  const waiting = applied(state, playAnswer(state, side, id, "points"), rs).state;
  return placeAll(applied(waiting, orderAnswer(waiting, side, "before"), rs), rs);
}

/** LIO plays its own l9, whose effect is `effect`, for its event, with Escalation at `from`. */
function lioPlays(effect: Step[], from = 2, map = true) {
  const rs = withCards(sideCard("l9", 2, effect));
  const s = atLioPlay(rs, setupFor({ lio: ["l9"] }, map));
  const start = map ? at(s, from) : s;
  return { before: start, after: applied(start, playAnswer(start, "lio", "l9", "event"), rs) };
}

describe("escalate in a game with the test map", () => {
  it("an LIO card's event played by LIO moves 2 to 3 with one escalationChanged (2 to 3)", () => {
    const { after } = lioPlays([escalate(1)]);
    expect(after.state.public.escalation).toBe(3);
    expect(escalationEvents(after.events)).toEqual([changed(2, 3)]);
  });

  it("by -1 moves 2 to 1", () => {
    const { after } = lioPlays([escalate(-1)]);
    expect(after.state.public.escalation).toBe(1);
    expect(escalationEvents(after.events)).toEqual([changed(2, 1)]);
  });

  it("by -1 at 0 leaves 0 with no event", () => {
    const { after } = lioPlays([escalate(-1)], 0);
    expect(after.state.public.escalation).toBe(0);
    expect(escalationEvents(after.events)).toEqual([]);
  });

  it("an LIO card's event played by SAE for points that raises 5 by 1 is a crisis whose draw comes from SAE's deck", () => {
    const rs = withCards(sideCard("l9", 2, [escalate(1)]));
    const s = at(atSaePlay(rs, setupFor({ sae: ["l9"] })), 5);
    const drawn = s.secret.contingency.sae[0]!;
    const r = playRival(s, "sae", "l9", rs);
    expect(escalationEvents(r.events).slice(0, 3)).toEqual([changed(5, 6), crisis("sae", drawn), changed(6, 3)]);
    expect(r.events).toContainEqual({ kind: "contingencyDrawn", visibility: "public", deck: "sae", value: drawn });
    expect(r.state.secret.contingency.lio).toEqual(s.secret.contingency.lio);
    expect(r.state.secret.contingency.world).toEqual(s.secret.contingency.world);
  });

  it("the same card picked by SAE as its opening card and raising 5 is a crisis that SAE caused", () => {
    const rs = withCards(sideCard("l9", 2, [escalate(1)]));
    const s = at(startGame(2, 1, rs, setupFor({ sae: ["l9"] })), 5);
    const drawn = s.secret.contingency.sae[0]!;
    const r = openWith(s, "l1", "l9", rs);
    expect(escalationEvents(r.events)).toEqual([changed(5, 6), crisis("sae", drawn), changed(6, 3)]);
    expect(r.events).toContainEqual({ kind: "contingencyDrawn", visibility: "public", deck: "sae", value: drawn });
  });

  it("an escalate inside an if branch names the card's player (SAE, playing LIO's card) as the causer", () => {
    const inIf: Step = { op: "if", cond: { op: "playedBy", side: "sae" }, then: [escalate(1)] };
    const rs = withCards(sideCard("l9", 2, [inIf]));
    const s = at(atSaePlay(rs, setupFor({ sae: ["l9"] })), 5);
    const r = playRival(s, "sae", "l9", rs);
    expect(escalationEvents(r.events)).toContainEqual(crisis("sae", s.secret.contingency.sae[0]!));
  });

  it("an escalate inside a turnEnd trigger reaction names the card's player (SAE, playing LIO's card) as the causer", () => {
    const reaction: Step = { op: "trigger", hook: "turnEnd", do: [escalate(1)], duration: { kind: "turnEnd" } };
    const rs = withCards(sideCard("l9", 2, [reaction]));
    const s = at(atSaePlay(rs, setupFor({ sae: ["l9"] })), 5);
    const r = playRival(s, "sae", "l9", rs);
    expect(r.events).toContainEqual({ kind: "triggerFired", visibility: "public", source: "l9", hook: "turnEnd" });
    expect(escalationEvents(r.events)).toEqual([
      changed(5, 6),
      crisis("sae", s.secret.contingency.sae[0]!),
      changed(6, 3),
      changed(3, 2),
    ]);
  });

  it("apply never mutates its input when it runs the step (frozen input)", () => {
    const rs = withCards(sideCard("l9", 2, [escalate(1)]));
    const s = deepFreeze(at(atLioPlay(rs, setupFor({ lio: ["l9"] })), 2));
    const r = applied(s, playAnswer(s, "lio", "l9", "event"), rs);
    expect(s.public.escalation).toBe(2);
    expect(r.state.public.escalation).toBe(3);
  });
});

describe("escalate in a program with no player", () => {
  const mapGame = (): GameState => {
    const r = createGame(ruleset, { ...makeSetup(), firstEra: "era-1", map: testMap() }, "seed-1");
    if (!r.ok) throw new Error(r.error.code);
    return playAnswers(r.value.state, 2); // The opening picks are in, so LIO's play is open and no program runs.
  };

  it.each([
    ["with a map", true],
    ["without a map", false],
  ] as const)("a raise with no player is invalidProgram, %s", (_case, map) => {
    const r = startProgram(ruleset, map ? mapGame() : startAtPlay(), [escalate(1)]);
    expect(r.ok ? null : r.error).toEqual({
      code: "invalidProgram",
      message: "A raise of Escalation needs the side that played the card.",
    });
  });

  it("a lower with no player runs", () => {
    const r = startProgram(ruleset, mapGame(), [escalate(-1)]);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.state.public.escalation).toBe(1);
    expect(escalationEvents(r.value.events)).toEqual([changed(2, 1)]);
  });
});

describe("escalate in a game without a map", () => {
  it("a raise and a lower, each with a player, leave the state as it was and emit nothing", () => {
    const moved = lioPlays([escalate(1), escalate(-1)], 2, false).after;
    const plain = lioPlays([], 2, false).after;
    expect("escalation" in moved.state.public).toBe(false);
    expect(moved.state).toEqual(plain.state);
    expect(moved.events).toEqual(plain.events);
  });
});

describe("createGame: a card's escalate step moves by a non-zero whole number", () => {
  /** `step` at the top of an effect, in an if's then and else, in a forEach and in a trigger's reaction. */
  const nested = (step: Step): Step[][] => [
    [step],
    [choose("go"), ifYes("go", [step])],
    [choose("go"), ifYes("go", [], [step])],
    [forEach(["a"], "x", [step])],
    [{ op: "trigger", hook: "turnEnd", do: [step], duration: { kind: "turnEnd" } }],
  ];
  const withL1 = (effect: Step[]): CardDef[] => [...ruleset.cards.slice(1), testCard("l1", 1, "lio", effect)];
  const outcomeOf = (effect: Step[]) => {
    const r = createGame({ ...ruleset, cards: withL1(effect) }, makeSetup(), "seed-1");
    return r.ok ? "ok" : r.error;
  };

  it.each([0, 1.5, Number.NaN])("refuses a by of %s, at any depth, with a plain message", (by) => {
    for (const effect of nested(escalate(by))) {
      expect(outcomeOf(effect)).toEqual({
        code: "invalidRuleset",
        message: "Card l1's effect moves Escalation by an amount that is not a non-zero whole number.",
      });
    }
  });

  it.each([1, -1, 2])("accepts a by of %s, at any depth", (by) => {
    for (const effect of nested(escalate(by))) expect(outcomeOf(effect)).toBe("ok");
  });
});
