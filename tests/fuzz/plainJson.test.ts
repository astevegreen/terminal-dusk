// Hard rule 5 in the fuzz checks: every state is plain JSON with integers only, and firstDifference never
// counts two values that are not plain JSON (NaN, undefined, Infinity) as equal.
import { createGame, seedHash } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkPlainJson, checkStep, firstDifference, NEW_GAME } from "./checks.ts";
import { ruleset } from "./play.ts";

const SEED = "plain-json-seed";
const setup: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
  deck: ["c6", "c7", "c8", "c9", "c10"],
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
};

function started(): { state: GameState; events: GameEvent[] } {
  const r = createGame(ruleset, setup, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value;
}

/** The new game with `value` put at public.extra. */
const withExtra = (value: unknown): GameState => {
  const { state } = started();
  return { ...state, public: { ...state.public, extra: value } } as unknown as GameState;
};

describe("firstDifference", () => {
  it("finds no difference between equal plain JSON values", () => {
    expect(firstDifference({ a: [1, "x", null, true] }, { a: [1, "x", null, true] }, "v")).toBeNull();
  });

  it("counts NaN, undefined and Infinity as a difference even when both sides hold them", () => {
    expect(firstDifference({ a: Number.NaN }, { a: Number.NaN }, "v")).toBe("v.a");
    expect(firstDifference({ a: undefined }, { a: undefined }, "v")).toBe("v.a");
    expect(firstDifference([Infinity], [Infinity], "v")).toBe("v.0");
  });
});

describe("checkPlainJson", () => {
  it("passes a new game's state", () => {
    expect(() => checkPlainJson(started().state)).not.toThrow();
  });

  it("fails a number that is not a whole number, naming where it is", () => {
    expect(() => checkPlainJson(withExtra(1.5))).toThrow(/state\.public\.extra is 1\.5, not a whole number/);
    expect(() => checkPlainJson(withExtra([2 ** 60]))).toThrow(/state\.public\.extra\.0 .* not a whole number/);
  });

  it("fails a value that does not survive a JSON round trip", () => {
    expect(() => checkPlainJson(withExtra(undefined))).toThrow(/not plain JSON: state\.public\.extra/);
    expect(() => checkPlainJson(withExtra(new Map()))).toThrow(/not plain JSON: state\.public\.extra/);
    expect(() => checkPlainJson(withExtra({ when: new Date(0) }))).toThrow(/not plain JSON: state\.public\.extra/);
  });

  it("is one of the checks every fuzz step runs", () => {
    const { events } = started();
    expect(() => checkStep(ruleset, setup, withExtra(0.25), events, SEED, NEW_GAME)).toThrow(/not a whole number/);
  });
});
