// R17a: the Escalation track (docs/design/map-and-points.md, "Escalation"): it starts at 2 in a game with a map,
// raiseEscalation and lowerEscalation move it within 0 to 6, a raise to 6 is a crisis, and it falls by 1 at the end
// of every turn.
import { describe, expect, it } from "vitest";
import { lowerEscalation, raiseEscalation } from "./escalation.ts";
import { createGame, viewFor } from "./index.ts";
import type { GameEvent, GameState, Setup, Side } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { applied, makeSetup, playAnswers, ruleset } from "./test/game.ts";
import { legalAnswers } from "./decisions.ts";
import { mapSetup, testMap } from "./test/map.ts";

const build = (setup: Setup = mapSetup()): GameState => {
  const r = createGame(ruleset, setup, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
};

/** A deep copy of plain JSON, such as a game state. */
const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A working copy of a new map game with Escalation at `at`, as apply's helpers get it. */
const workingAt = (at: number): GameState => {
  const state = copyOf(build());
  state.public.escalation = at;
  return state;
};

const escalationEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "escalationChanged" || e.kind === "escalationCrisis");

/** Answers the first open decision with its first legal answer, and returns the step's state and events. */
function step(state: GameState): { state: GameState; events: GameEvent[] } {
  const d = state.public.pending[0]!;
  return applied(state, { decisionId: d.id, side: d.side, value: legalAnswers(ruleset, state, d.side)[0]! });
}

describe("the Escalation track at the start", () => {
  it("a game started with a map has Escalation 2", () => {
    expect(build().public.escalation).toBe(2);
  });
  it("a game started without a map has no escalation field", () => {
    expect("escalation" in build(makeSetup()).public).toBe(false);
  });
  it("is public: LIO, SAE and spectators all see it", () => {
    const state = build();
    for (const viewer of ["lio", "sae", "spectator"] as const) expect(viewFor(state, viewer).public.escalation).toBe(2);
  });
});

describe("raiseEscalation and lowerEscalation", () => {
  it("a raise below 6 moves the value up with one escalationChanged event and draws nothing", () => {
    const state = workingAt(2);
    const before = copyOf(state.public.contingency);
    const events: GameEvent[] = [];
    raiseEscalation(state, 3, "lio", events);
    expect(state.public.escalation).toBe(5);
    expect(events).toEqual([{ kind: "escalationChanged", visibility: "public", from: 2, to: 5 }]);
    expect(state.public.contingency).toEqual(before);
  });
  it("a lower moves the value down with one escalationChanged event", () => {
    const state = workingAt(4);
    const events: GameEvent[] = [];
    lowerEscalation(state, 1, events);
    expect(state.public.escalation).toBe(3);
    expect(events).toEqual([{ kind: "escalationChanged", visibility: "public", from: 4, to: 3 }]);
  });
  it("a lower stops at 0", () => {
    const state = workingAt(2);
    const events: GameEvent[] = [];
    lowerEscalation(state, 5, events);
    expect(state.public.escalation).toBe(0);
    expect(events).toEqual([{ kind: "escalationChanged", visibility: "public", from: 2, to: 0 }]);
  });
  it("lowering at 0 changes nothing and emits no event", () => {
    const state = workingAt(0);
    const events: GameEvent[] = [];
    lowerEscalation(state, 1, events);
    expect(state.public.escalation).toBe(0);
    expect(events).toEqual([]);
  });
  it("in a game without a map both do nothing", () => {
    const state = copyOf(build(makeSetup()));
    const before = copyOf(state);
    const events: GameEvent[] = [];
    raiseEscalation(state, 4, "sae", events);
    lowerEscalation(state, 1, events);
    expect(state).toEqual(before);
    expect(events).toEqual([]);
  });
});

describe("a crisis at 6", () => {
  /** Raises Escalation from `from` by `by` for `causer`, checking the four crisis events and the end at 3. */
  function crisis(from: number, by: number, causer: Side): void {
    const state = workingAt(from);
    const drawn = state.secret.contingency[causer][0]!;
    const leftBefore = state.public.contingency[causer].left.length;
    const others = copyOf({ ...state.public, contingency: undefined, escalation: undefined });
    const events: GameEvent[] = [];
    raiseEscalation(state, by, causer, events);
    expect(events).toEqual([
      { kind: "escalationChanged", visibility: "public", from, to: 6 },
      { kind: "contingencyDrawn", visibility: "public", deck: causer, value: drawn },
      { kind: "escalationCrisis", visibility: "public", side: causer, value: drawn },
      { kind: "escalationChanged", visibility: "public", from: 6, to: 3 },
    ]);
    expect(state.public.escalation).toBe(3);
    expect(state.public.contingency[causer].left.length).toBe(leftBefore - 1);
    // Nothing else in the public state changes: no score, no influence.
    expect({ ...state.public, contingency: undefined, escalation: undefined }).toEqual(others);
  }

  it.each(["lio", "sae"] as const)("a raise from 5 by %s draws from that side's own deck and leaves 3", (side) => {
    crisis(5, 1, side);
  });
  it("a raise of 2 from 5 stops at 6 and is one crisis", () => {
    crisis(5, 2, "lio");
  });
  it("a raise of 3 from 3 is one crisis and ends at 3", () => {
    crisis(3, 3, "sae");
  });
  it("the crisis draw is an ordinary draw: it counts toward the reshuffle", () => {
    // The default deck holds 6 cards; a draw leaving 2 reshuffles it. Three draws first leave 3.
    const state = workingAt(5);
    const events: GameEvent[] = [];
    state.secret.contingency.lio = state.secret.contingency.lio.slice(3);
    state.public.contingency.lio.left = [...state.secret.contingency.lio].sort((a, b) => a - b);
    raiseEscalation(state, 1, "lio", events);
    expect(events.map((e) => e.kind)).toEqual([
      "escalationChanged",
      "contingencyDrawn",
      "contingencyDeckReshuffled",
      "escalationCrisis",
      "escalationChanged",
    ]);
    expect(state.public.contingency.lio.left).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("Escalation at the end of each turn", () => {
  it("2 becomes 1 after a turn, with one escalationChanged event", () => {
    let s = build();
    let events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) ({ state: s, events } = step(s));
    expect(s.public.turn).toBe(2);
    expect(s.public.escalation).toBe(1);
    expect(escalationEvents(events)).toEqual([{ kind: "escalationChanged", visibility: "public", from: 2, to: 1 }]);
  });
  it("the final turn's fall happens before the game ends", () => {
    let s = build(mapSetup(testMap(), 1));
    let events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) ({ state: s, events } = step(s));
    expect(s.public.status.kind).toBe("over");
    expect(s.public.escalation).toBe(1);
    expect(escalationEvents(events)).toEqual([{ kind: "escalationChanged", visibility: "public", from: 2, to: 1 }]);
  });
  it("0 stays 0 at a turn's end, with no event", () => {
    const at = playAnswers(build(), 3);
    const s = { ...at, public: { ...at.public, escalation: 0 } };
    const { state, events } = step(s);
    expect(state.public.turn).toBe(2);
    expect(state.public.escalation).toBe(0);
    expect(escalationEvents(events)).toEqual([]);
  });
  it("a game without a map is unchanged: no escalation field and no event", () => {
    let s = build(makeSetup());
    let events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) ({ state: s, events } = step(s));
    expect(s.public.turn).toBe(2);
    expect("escalation" in s.public).toBe(false);
    expect(escalationEvents(events)).toEqual([]);
  });
  it("apply never mutates its input when Escalation falls (frozen input)", () => {
    const at = deepFreeze(playAnswers(build(), 3));
    const { state } = step(at);
    expect(at.public.escalation).toBe(2);
    expect(state.public.escalation).toBe(1);
  });
});
