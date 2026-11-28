// Glicko-2 calculator (#678): checked against the worked example in Glickman's paper "Example of the Glicko-2
// system" (a 1500 player with deviation 200 against three opponents), plus the behaviours the issue lists.
import { describe, expect, it } from "vitest";
import {
  DEVIATION_CEILING,
  DEVIATION_FLOOR,
  displayRating,
  isGlicko2Rating,
  isProvisional,
  PROVISIONAL_GAMES,
  START_RATING,
  updateRating,
} from "./glicko2.ts";
import type { Glicko2Rating, RatedGame } from "./glicko2.ts";
import { deepFreeze } from "./test/deepFreeze.ts";

const rating = (r: number, deviation: number, volatility = 0.06): Glicko2Rating => ({
  rating: r,
  deviation,
  volatility,
});

const paperPlayer = rating(1500, 200);
const paperGames: RatedGame[] = [
  { opponent: rating(1400, 30), score: "win" },
  { opponent: rating(1550, 100), score: "loss" },
  { opponent: rating(1700, 300), score: "loss" },
];

describe("updateRating: Glickman's published worked example", () => {
  it("1500/200/0.06 after a win and two losses becomes 1464.06 / 151.52 / 0.05999", () => {
    const next = updateRating(paperPlayer, paperGames);
    expect(next).not.toBeNull();
    // The paper prints two decimals for rating and deviation. Its rating, 1464.06, comes from rounded in-between
    // values; the exact result is 1464.0507, so the rating is held to within 0.015 of the printed figure.
    expect(Math.abs(next!.rating - 1464.06)).toBeLessThan(0.015);
    expect(next!.deviation).toBeCloseTo(151.52, 2);
    // The paper prints volatility cut off (not rounded) at five decimals: 0.05999 means 0.05999 <= sigma < 0.06.
    expect(next!.volatility).toBeGreaterThanOrEqual(0.05999);
    expect(next!.volatility).toBeLessThan(0.06);
    expect(displayRating(next!)).toBe(1464);
  });

  it("does not change its inputs", () => {
    const player = deepFreeze(rating(1500, 200));
    const games = deepFreeze(paperGames.map((g) => ({ ...g, opponent: { ...g.opponent } })));
    expect(() => updateRating(player, games)).not.toThrow();
    expect(player).toEqual(rating(1500, 200));
  });
});

describe("updateRating: the behaviours the issue asks for", () => {
  it("a player with no games in the period: deviation grows, rating and volatility stay", () => {
    const next = updateRating(paperPlayer, [])!;
    expect(next.rating).toBe(1500);
    expect(next.volatility).toBe(0.06);
    expect(next.deviation).toBeGreaterThan(200);
    // sqrt(phi^2 + sigma^2) on the Glicko-2 scale, converted back.
    expect(next.deviation).toBeCloseTo(Math.sqrt((200 / 173.7178) ** 2 + 0.06 ** 2) * 173.7178, 6);
  });

  it("a period with no games never pushes the deviation above the starting value", () => {
    expect(updateRating(rating(1500, 349.9), [])!.deviation).toBe(DEVIATION_CEILING);
  });

  it("a win against a stronger player moves the rating more than a win against a weaker one", () => {
    const player = rating(1500, 100);
    const beatStrong = updateRating(player, [{ opponent: rating(1800, 100), score: "win" }])!;
    const beatWeak = updateRating(player, [{ opponent: rating(1200, 100), score: "win" }])!;
    expect(beatStrong.rating - 1500).toBeGreaterThan(beatWeak.rating - 1500);
    expect(beatWeak.rating).toBeGreaterThan(1500);
  });

  it("a draw between equals leaves the rating where it was and shrinks the deviation", () => {
    const next = updateRating(rating(1500, 200), [{ opponent: rating(1500, 200), score: "draw" }])!;
    expect(next.rating).toBe(1500);
    expect(next.deviation).toBeLessThan(200);
    // Standard Glicko-2 (step 5 always runs): an exactly expected result also lowers volatility a little.
    expect(next.volatility).toBeLessThan(0.06);
  });

  it("a loss lowers the rating and a win raises it", () => {
    const opp = rating(1500, 100);
    expect(updateRating(paperPlayer, [{ opponent: opp, score: "loss" }])!.rating).toBeLessThan(1500);
    expect(updateRating(paperPlayer, [{ opponent: opp, score: "win" }])!.rating).toBeGreaterThan(1500);
  });

  it("many games against equals never take the deviation below the floor", () => {
    let r = rating(1500, 40);
    for (let i = 0; i < 50; i++) r = updateRating(r, Array(20).fill({ opponent: rating(1500, 30), score: "draw" }))!;
    expect(r.deviation).toBe(DEVIATION_FLOOR);
  });
});

describe("updateRating: illegal input is null, never a throw", () => {
  const bad: unknown[] = [
    null,
    {},
    rating(Number.NaN, 200),
    rating(1500, Number.POSITIVE_INFINITY),
    rating(1500, 10),
    rating(1500, 400),
    rating(1500, 200, 0),
    rating(1500, 200, 2),
    rating(-1, 200),
    rating(5001, 200),
  ];
  it("an illegal player", () => {
    for (const p of bad) expect(updateRating(p as Glicko2Rating, paperGames)).toBeNull();
  });
  it("an illegal opponent or score, or a games value that is not a list", () => {
    for (const o of bad) expect(updateRating(paperPlayer, [{ opponent: o as Glicko2Rating, score: "win" }])).toBeNull();
    for (const score of ["Win", "resign", "", 1, null])
      expect(updateRating(paperPlayer, [{ opponent: paperPlayer, score } as unknown as RatedGame])).toBeNull();
    expect(updateRating(paperPlayer, null as unknown as RatedGame[])).toBeNull();
  });
});

describe("start values, legality and the provisional rule", () => {
  it("a new player starts at 1500 with the standard deviation 350 and volatility 0.06", () => {
    expect(START_RATING).toEqual({ rating: 1500, deviation: 350, volatility: 0.06 });
    expect(isGlicko2Rating(START_RATING)).toBe(true);
    expect(displayRating(START_RATING)).toBe(1500);
  });

  it("displayRating rounds to a whole number", () => {
    expect(displayRating(rating(1464.5, 100))).toBe(1465);
    expect(displayRating(rating(1464.49, 100))).toBe(1464);
  });

  it("isProvisional is true before the 10th finished ranked game and false from it on", () => {
    expect(PROVISIONAL_GAMES).toBe(10);
    for (let n = 0; n < 10; n++) expect(isProvisional(n)).toBe(true);
    for (const n of [10, 11, 500]) expect(isProvisional(n)).toBe(false);
  });
});
