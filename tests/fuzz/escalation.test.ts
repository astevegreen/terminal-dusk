// The Escalation check (escalationChecks.ts, R17a) catches what it should. The map fuzz suite (influence.test.ts)
// runs it, with every other check, on every step of its games.
import { scenarioSetup, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import { createGame } from "@terminal-dusk/engine";
import type { GameEvent, GameState, PublicState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkEscalation } from "./escalationChecks.ts";
import { randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";

const testMap = (): NonNullable<Setup["map"]> => scenarioSetup(TEST_MAP_SCENARIO).map!;

/** The state createGame makes from fuzz game 1's setup, with the test map unless `withMap` is false. */
function started(withMap = true): { setup: Setup; state: GameState } {
  const { setup: base, seed } = randomGame(seededRng(1), 1);
  const setup = withMap ? { ...base, map: testMap() } : base;
  const r = createGame(ruleset, setup, seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return { setup, state: r.value.state };
}

const withPublic = (state: GameState, change: Partial<PublicState>): GameState => ({
  ...state,
  public: { ...state.public, ...change },
});

const changed = (from: number, to: number): GameEvent => ({
  kind: "escalationChanged",
  visibility: "public",
  from,
  to,
});

describe("the Escalation check", () => {
  it("passes a new game with the test map at 2, and one without a map", () => {
    const withMap = started();
    expect(() => checkEscalation(withMap.setup, withMap.state, [], [])).not.toThrow();
    const noMap = started(false);
    expect(() => checkEscalation(noMap.setup, noMap.state, [], [])).not.toThrow();
  });

  it("fails a value outside 0 to 6 or not a whole number", () => {
    const { setup, state } = started();
    for (const bad of [-1, 7, 2.5, Number.NaN]) {
      expect(() => checkEscalation(setup, withPublic(state, { escalation: bad }), [], [])).toThrow(/from 0 to 6/);
    }
  });

  it("fails a game with a map whose state has no escalation", () => {
    const { setup, state } = started();
    const pub: PublicState = { ...state.public };
    delete pub.escalation;
    expect(() => checkEscalation(setup, { ...state, public: pub }, [], [])).toThrow(/from 0 to 6/);
  });

  it("fails a game without a map that has escalation", () => {
    const { setup, state } = started(false);
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 2 }), [], [])).toThrow(/`escalation`/);
  });

  it("fails a change between two steps with no escalationChanged event", () => {
    const { setup, state } = started();
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 3 }), [], [])).toThrow(/leave it at 2/);
  });

  it("fails a value that is not the last escalationChanged event's `to`", () => {
    const { setup, state } = started();
    const events = [changed(2, 1)];
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 2 }), events, events)).toThrow(/leave it at 1/);
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 1 }), events, events)).not.toThrow();
  });

  it("fails an escalationChanged event whose `from` is not the value before it", () => {
    const { setup, state } = started();
    const events = [changed(3, 6), changed(6, 3)];
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 3 }), events, events)).toThrow(/goes from 3/);
  });

  it("reads the value before a step from the game's earlier events", () => {
    const { setup, state } = started();
    const earlier = [changed(2, 1)];
    const now = [changed(1, 0)];
    const all = [...earlier, ...now];
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 0 }), now, all)).not.toThrow();
    expect(() => checkEscalation(setup, withPublic(state, { escalation: 1 }), [], earlier)).not.toThrow();
  });
});
