import { describe, expect, it } from "vitest";
import { playPasses, startGame } from "./test/game.ts";

// createGame's rejection of rounds below 1 is tested in createGame.test.ts.

describe("placeholder game (replaced by the turn-structure task, #35)", () => {
  it("createGame keeps the number of rounds the setup gives", () => {
    expect(startGame(5).public.rounds).toBe(5);
  });
  it("LIO answers first, then the sides alternate", () => {
    let s = startGame(3);
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      order.push(s.public.pending[0]!.side);
      s = playPasses(s, 1);
    }
    expect(order).toEqual(["lio", "sae", "lio", "sae", "lio", "sae"]);
  });
  it("public.turn goes up by 1 after each pair of answers", () => {
    let s = startGame(3);
    expect(s.public.turn).toBe(1);
    s = playPasses(s, 1);
    expect(s.public.turn).toBe(1);
    s = playPasses(s, 1);
    expect(s.public.turn).toBe(2);
    s = playPasses(s, 2);
    expect(s.public.turn).toBe(3);
  });
  it("after rounds x 2 answers the game is over with reason placeholderFinished and no winner", () => {
    for (const rounds of [1, 2, 4]) {
      const almost = playPasses(startGame(rounds), rounds * 2 - 1);
      expect(almost.public.status).toEqual({ kind: "active" });
      const over = playPasses(almost, 1);
      expect(over.public.status).toEqual({ kind: "over", winner: null, reason: "placeholderFinished" });
      expect(over.public.pending).toEqual([]);
    }
  });
});
