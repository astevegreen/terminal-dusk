// Drawing a contingency (#65): the top card of a side's deck is the result, and a draw that leaves one
// card shuffles the whole deck back together, straight after the draw.
import { describe, expect, it } from "vitest";
import { drawContingency } from "./contingency.ts";
import { copyJson } from "./copy.ts";
import { createGame, seedHash } from "./index.ts";
import type { GameEvent, GameState, Setup, Side } from "./index.ts";
import { shuffle } from "./rng.ts";
import { makeSetup, ruleset } from "./test/game.ts";

const SEED = "draw-seed";
const ONE_TO_SIX = [1, 2, 3, 4, 5, 6];

/** A new game with these Contingency decks. */
function fresh(lio: number[], sae: number[] = ONE_TO_SIX): GameState {
  const setup: Setup = { ...makeSetup(), contingency: { lio, sae } };
  const r = createGame(ruleset, { ...setup, seedHash: seedHash(SEED) }, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

type Drawn = { state: GameState; value: number; events: GameEvent[] };

/** One draw for `side`, on a working copy of `state`, as apply would make. `state` itself is left alone. */
function draw(state: GameState, side: Side): Drawn {
  const next = copyJson(state);
  const events: GameEvent[] = [];
  const value = drawContingency(next, side, events);
  return { state: next, value, events };
}

/** `count` draws for `side` in a row, each from the state the last one left. */
function drawMany(state: GameState, side: Side, count: number): Drawn[] {
  const out: Drawn[] = [];
  let current = state;
  for (let i = 0; i < count; i++) {
    const d = draw(current, side);
    out.push(d);
    current = d.state;
  }
  return out;
}

const count = (numbers: readonly number[], n: number): number => numbers.filter((x) => x === n).length;

describe("drawing a contingency", () => {
  it("takes the top card of the side's secret order, returns its number and removes it from the numbers left", () => {
    const s = fresh(ONE_TO_SIX);
    const [top, ...rest] = s.secret.contingency.lio;
    const d = draw(s, "lio");
    expect(d.value).toBe(top);
    expect(d.state.secret.contingency.lio).toEqual(rest);
    expect(d.state.public.contingency.lio.left).toEqual(ONE_TO_SIX.filter((n) => n !== top));
    expect(d.state.public.contingency.lio.cards).toEqual(ONE_TO_SIX);
  });

  it("on a 1-6 deck, draws 1-4 each emit only contingencyDrawn; draw 5 emits contingencyDrawn then contingencyDeckReshuffled", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "lio", 5);
    for (const d of draws.slice(0, 4)) {
      expect(d.events).toEqual([{ kind: "contingencyDrawn", visibility: "public", side: "lio", value: d.value }]);
    }
    expect(draws[4]!.events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "lio", value: draws[4]!.value },
      { kind: "contingencyDeckReshuffled", visibility: "public", side: "lio" },
    ]);
  });

  it("on a 1-6 deck, the five numbers drawn are all different", () => {
    const values = drawMany(fresh(ONE_TO_SIX), "sae", 5).map((d) => d.value);
    expect(new Set(values).size).toBe(5);
  });

  it("after draw 5 the secret order and generator equal shuffle(the generator before the reshuffle, [1..6])", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "lio", 5);
    const before = draws[3]!.state;
    const expected = shuffle(before.secret.rng, ONE_TO_SIX);
    const after = draws[4]!.state;
    expect(after.secret.contingency.lio).toEqual(expected.items);
    expect(after.secret.rng).toEqual(expected.state);
    expect(after.secret.rng).not.toEqual(before.secret.rng);
    expect(after.public.contingency.lio).toEqual({ cards: ONE_TO_SIX, left: ONE_TO_SIX });
  });

  it("draws 1-4 leave the generator alone; only the reshuffle advances it", () => {
    const s = fresh(ONE_TO_SIX);
    for (const d of drawMany(s, "lio", 4)) expect(d.state.secret.rng).toEqual(s.secret.rng);
  });

  it("the reshuffle is not the opening order played again, across seeds", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `draw-seed-${i}`);
    const replays = seeds.filter((seed) => {
      const r = createGame(ruleset, makeSetup(2, 1, seed), seed);
      if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
      const opening = r.value.state.secret.contingency.lio;
      return (
        JSON.stringify(drawMany(r.value.state, "lio", 5)[4]!.state.secret.contingency.lio) === JSON.stringify(opening)
      );
    });
    expect(replays.length).toBeLessThan(5);
  });

  it("a custom deck [2,2,4,4,6,6]: after a 2 is drawn the other 2 is still left, and it reshuffles back to exactly those cards", () => {
    const deck = [2, 2, 4, 4, 6, 6];
    const draws = drawMany(fresh(deck), "lio", 5);
    // Before the reshuffle, each number is left as many times as it is in the deck less the times drawn.
    for (const [i, d] of draws.slice(0, 4).entries()) {
      const drawnSoFar = draws.slice(0, i + 1).map((x) => x.value);
      const left = d.state.public.contingency.lio.left;
      for (const n of [2, 4, 6]) expect(count(left, n)).toBe(2 - count(drawnSoFar, n));
      expect(left).toEqual([...d.state.secret.contingency.lio].sort((a, b) => a - b));
    }
    expect(draws.slice(0, 4).some((d) => d.value === 2)).toBe(true);
    const after = draws[4]!.state;
    expect([...after.secret.contingency.lio].sort((a, b) => a - b)).toEqual(deck);
    expect(after.public.contingency.lio).toEqual({ cards: deck, left: deck });
  });

  it("removes exactly one 2 from the numbers left when the top card is a 2", () => {
    const s = fresh([2, 2, 4, 4, 6, 6]);
    const stacked = copyJson(s);
    stacked.secret.contingency.lio = [2, 4, 6, 2, 4, 6];
    const d = draw(stacked, "lio");
    expect(d.value).toBe(2);
    expect(d.state.public.contingency.lio.left).toEqual([2, 4, 4, 6, 6]);
  });

  it("a 2-card deck reshuffles on its first draw, emitting both events", () => {
    const s = fresh([3, 7]);
    const d = draw(s, "lio");
    expect([3, 7]).toContain(d.value);
    expect(d.events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", side: "lio", value: d.value },
      { kind: "contingencyDeckReshuffled", visibility: "public", side: "lio" },
    ]);
    expect(d.state.secret.contingency.lio).toEqual(shuffle(s.secret.rng, [3, 7]).items);
    expect(d.state.public.contingency.lio).toEqual({ cards: [3, 7], left: [3, 7] });
  });

  it("drawing from one side's deck never changes the other side's deck", () => {
    const s = fresh(ONE_TO_SIX, [2, 5, 9]);
    for (const [side, other] of [
      ["lio", "sae"],
      ["sae", "lio"],
    ] as const) {
      for (const d of drawMany(s, side, 5)) {
        expect(d.state.public.contingency[other]).toEqual(s.public.contingency[other]);
        expect(d.state.secret.contingency[other]).toEqual(s.secret.contingency[other]);
      }
    }
  });

  it("no event carries a deck order: only the side, and for a draw the number drawn", () => {
    for (const d of drawMany(fresh([2, 5]), "sae", 3)) {
      for (const event of d.events)
        expect(Object.keys(event).sort()).toEqual(
          event.kind === "contingencyDrawn" ? ["kind", "side", "value", "visibility"] : ["kind", "side", "visibility"],
        );
    }
  });
});
