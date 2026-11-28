// Property test (#678): for any legal player and any legal list of games, the new rating is legal again:
// finite, deviation within [floor, starting value], volatility within its range.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEVIATION_CEILING, DEVIATION_FLOOR, isGlicko2Rating, updateRating } from "./glicko2.ts";
import type { Glicko2Rating, RatedGame } from "./glicko2.ts";

const legalRating: fc.Arbitrary<Glicko2Rating> = fc.record({
  rating: fc.double({ min: 0, max: 5000, noNaN: true }),
  deviation: fc.double({ min: DEVIATION_FLOOR, max: DEVIATION_CEILING, noNaN: true }),
  volatility: fc.double({ min: 0.000001, max: 1, noNaN: true }),
});

const game: fc.Arbitrary<RatedGame> = fc.record({
  opponent: legalRating,
  score: fc.constantFrom<RatedGame["score"]>("win", "draw", "loss"),
});

describe("updateRating: legal in, legal out", () => {
  it("deviation never below the floor nor above the starting value; every number finite", () => {
    fc.assert(
      fc.property(legalRating, fc.array(game, { maxLength: 30 }), (player, games) => {
        const next = updateRating(player, games);
        expect(next).not.toBeNull();
        expect(Number.isFinite(next!.rating)).toBe(true);
        expect(Number.isFinite(next!.volatility)).toBe(true);
        expect(next!.deviation).toBeGreaterThanOrEqual(DEVIATION_FLOOR);
        expect(next!.deviation).toBeLessThanOrEqual(DEVIATION_CEILING);
        expect(isGlicko2Rating(next)).toBe(true);
      }),
    );
  });

  it("extremes: the weakest legal player beating the strongest, many times over, stays legal", () => {
    const low: Glicko2Rating = { rating: 0, deviation: DEVIATION_CEILING, volatility: 1 };
    const high: Glicko2Rating = { rating: 5000, deviation: DEVIATION_FLOOR, volatility: 0.000001 };
    const next = updateRating(low, Array<RatedGame>(30).fill({ opponent: high, score: "win" }));
    expect(isGlicko2Rating(next)).toBe(true);
    expect(isGlicko2Rating(updateRating(high, Array<RatedGame>(30).fill({ opponent: low, score: "loss" })))).toBe(true);
  });
});
