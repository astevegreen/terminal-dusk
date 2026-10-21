// Drawing a contingency (#65, #130): the top card of a side's deck is the result, and a draw that leaves
// two cards shuffles the whole deck back together, straight after the draw.
import { describe, expect, it } from "vitest";
import { drawContingency } from "./contingency.ts";
import { copyJson } from "./copy.ts";
import { createGame, seedHash } from "./index.ts";
import type { DeckId, GameEvent, GameState, Setup } from "./index.ts";
import { shuffle } from "./rng.ts";
import { makeSetup, ruleset } from "./test/game.ts";

const SEED = "draw-seed";
const ONE_TO_SIX = [1, 2, 3, 4, 5, 6];

/** A new game with these Contingency decks. */
function fresh(lio: number[], sae: number[] = ONE_TO_SIX, world: number[] = ONE_TO_SIX): GameState {
  const setup: Setup = { ...makeSetup(), contingency: { lio, sae, world } };
  const r = createGame(ruleset, { ...setup, seedHash: seedHash(SEED) }, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

type Drawn = { state: GameState; value: number; events: GameEvent[] };

/** One draw for `side`, on a working copy of `state`, as apply would make. `state` itself is left alone. */
function draw(state: GameState, side: DeckId): Drawn {
  const next = copyJson(state);
  const events: GameEvent[] = [];
  const value = drawContingency(next, side, events);
  return { state: next, value, events };
}

/** `count` draws for `side` in a row, each from the state the last one left. */
function drawMany(state: GameState, side: DeckId, count: number): Drawn[] {
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

  it("a draw that leaves three or more cards does not reshuffle; the draw that leaves exactly two does", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "lio", 4);
    expect(draws.map((d) => d.state.secret.contingency.lio.length)).toEqual([5, 4, 3, 6]);
    for (const d of draws.slice(0, 3)) {
      expect(d.events).toEqual([{ kind: "contingencyDrawn", visibility: "public", deck: "lio", value: d.value }]);
    }
    expect(draws[3]!.events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "lio", value: draws[3]!.value },
      { kind: "contingencyDeckReshuffled", visibility: "public", deck: "lio" },
    ]);
  });

  it("on a 1-6 deck, a side gets four draws per cycle: draws 1-3 only draw, draw 4 also reshuffles", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "sae", 8);
    const reshuffledAt = draws.flatMap((d, i) =>
      d.events.some((e) => e.kind === "contingencyDeckReshuffled") ? [i + 1] : [],
    );
    expect(reshuffledAt).toEqual([4, 8]);
  });

  it("on a 1-6 deck, the four numbers drawn in a cycle are all different", () => {
    const values = drawMany(fresh(ONE_TO_SIX), "sae", 4).map((d) => d.value);
    expect(new Set(values).size).toBe(4);
  });

  it("the fifth draw comes from a rebuilt deck of six: it takes the rebuilt order's top card and leaves five", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "lio", 5);
    const rebuilt = draws[3]!.state;
    expect(rebuilt.secret.contingency.lio).toHaveLength(6);
    const [top, ...rest] = rebuilt.secret.contingency.lio;
    expect(draws[4]!.value).toBe(top);
    expect(draws[4]!.state.secret.contingency.lio).toEqual(rest);
    expect(draws[4]!.events).toEqual([{ kind: "contingencyDrawn", visibility: "public", deck: "lio", value: top }]);
  });

  it("after draw 4 the secret order and generator equal shuffle(the generator before the reshuffle, [1..6]), the two left included", () => {
    const draws = drawMany(fresh(ONE_TO_SIX), "lio", 4);
    const before = draws[2]!.state;
    const expected = shuffle(before.secret.rng, ONE_TO_SIX);
    const after = draws[3]!.state;
    expect(after.secret.contingency.lio).toEqual(expected.items);
    expect(after.secret.rng).toEqual(expected.state);
    expect(after.secret.rng).not.toEqual(before.secret.rng);
    expect(after.public.contingency.lio).toEqual({ cards: ONE_TO_SIX, left: ONE_TO_SIX });
  });

  it("draws 1-3 leave the generator alone; only the reshuffle advances it", () => {
    const s = fresh(ONE_TO_SIX);
    for (const d of drawMany(s, "lio", 3)) expect(d.state.secret.rng).toEqual(s.secret.rng);
  });

  it("the reshuffle is not the opening order played again, across seeds", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `draw-seed-${i}`);
    const replays = seeds.filter((seed) => {
      const r = createGame(ruleset, makeSetup(2, 1, seed), seed);
      if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
      const opening = r.value.state.secret.contingency.lio;
      return (
        JSON.stringify(drawMany(r.value.state, "lio", 4)[3]!.state.secret.contingency.lio) === JSON.stringify(opening)
      );
    });
    expect(replays.length).toBeLessThan(5);
  });

  it("a custom deck [2,2,4,4,6,6]: after a 2 is drawn the other 2 is still left, and it reshuffles back to exactly those cards", () => {
    const deck = [2, 2, 4, 4, 6, 6];
    const draws = drawMany(fresh(deck), "lio", 4);
    // Before the reshuffle, each number is left as many times as it is in the deck less the times drawn.
    for (const [i, d] of draws.slice(0, 3).entries()) {
      const drawnSoFar = draws.slice(0, i + 1).map((x) => x.value);
      const left = d.state.public.contingency.lio.left;
      for (const n of [2, 4, 6]) expect(count(left, n)).toBe(2 - count(drawnSoFar, n));
      expect(left).toEqual([...d.state.secret.contingency.lio].sort((a, b) => a - b));
    }
    expect(draws.slice(0, 3).some((d) => d.value === 2)).toBe(true);
    const after = draws[3]!.state;
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

  it("a 3-card deck, the smallest, reshuffles on its first draw, emitting both events", () => {
    const s = fresh([3, 5, 7]);
    const d = draw(s, "lio");
    expect([3, 5, 7]).toContain(d.value);
    expect(d.events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "lio", value: d.value },
      { kind: "contingencyDeckReshuffled", visibility: "public", deck: "lio" },
    ]);
    expect(d.state.secret.contingency.lio).toEqual(shuffle(s.secret.rng, [3, 5, 7]).items);
    expect(d.state.public.contingency.lio).toEqual({ cards: [3, 5, 7], left: [3, 5, 7] });
  });

  it("a 3-card deck rebuilds after every draw, several draws in a row, so every draw is from three cards", () => {
    const s = fresh([3, 5, 7]);
    let before = s;
    for (const d of drawMany(s, "lio", 6)) {
      expect(before.secret.contingency.lio).toHaveLength(3);
      expect(d.value).toBe(before.secret.contingency.lio[0]);
      expect(d.events.map((e) => e.kind)).toEqual(["contingencyDrawn", "contingencyDeckReshuffled"]);
      expect(d.state.secret.contingency.lio).toEqual(shuffle(before.secret.rng, [3, 5, 7]).items);
      expect(d.state.public.contingency.lio).toEqual({ cards: [3, 5, 7], left: [3, 5, 7] });
      before = d.state;
    }
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

  it("the World deck is drawn and reshuffles by the same rule as the side decks, and leaves both side decks alone", () => {
    const s = fresh(ONE_TO_SIX, ONE_TO_SIX, [3, 5, 7]);
    const d = draw(s, "world");
    expect(d.value).toBe(s.secret.contingency.world[0]);
    expect(d.events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "world", value: d.value },
      { kind: "contingencyDeckReshuffled", visibility: "public", deck: "world" },
    ]);
    expect(d.state.secret.contingency.world).toEqual(shuffle(s.secret.rng, [3, 5, 7]).items);
    expect(d.state.public.contingency.world).toEqual({ cards: [3, 5, 7], left: [3, 5, 7] });
    for (const side of ["lio", "sae"] as const) {
      expect(d.state.public.contingency[side]).toEqual(s.public.contingency[side]);
      expect(d.state.secret.contingency[side]).toEqual(s.secret.contingency[side]);
    }
  });

  it("no event carries a deck order: only the deck, and for a draw the number drawn", () => {
    for (const d of drawMany(fresh([2, 5, 8]), "sae", 3)) {
      for (const event of d.events)
        expect(Object.keys(event).sort()).toEqual(
          event.kind === "contingencyDrawn" ? ["deck", "kind", "value", "visibility"] : ["deck", "kind", "visibility"],
        );
    }
  });
});
