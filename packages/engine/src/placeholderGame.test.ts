import { describe, expect, it } from "vitest";
import { playAnswers, startGame } from "./test/game.ts";

// createGame's rejection of rounds below 1 is tested in createGame.test.ts.
// Each round: both sides answer a secret yes/no pair, then LIO passes, then SAE passes (4 answers).

describe("placeholder game (replaced by the turn-structure task, #35)", () => {
  it("createGame keeps the number of rounds the setup gives", () => {
    expect(startGame(5).public.rounds).toBe(5);
  });
  it("each round opens with a simultaneous yes/no pair, then LIO passes, then SAE passes", () => {
    let s = startGame(3);
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      order.push(s.public.pending.map((d) => `${d.side}:${d.kind}`).join(" + "));
      s = playAnswers(s, 1);
    }
    const round = ["lio:yesNo + sae:yesNo", "sae:yesNo", "lio:pass", "sae:pass"];
    expect(order).toEqual([...round, ...round, ...round]);
  });
  it("the two decisions of a round's pair share one simultaneousGroup, new each round", () => {
    let s = startGame(3);
    const groups: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      const [lio, sae] = s.public.pending;
      expect(sae?.simultaneousGroup).toBe(lio?.simultaneousGroup);
      groups.push(lio?.simultaneousGroup);
      s = playAnswers(s, 4);
    }
    expect(groups.every((g) => typeof g === "string")).toBe(true);
    expect(new Set(groups).size).toBe(3);
  });
  it("public.turn goes up by 1 after each round's 4 answers, when SAE passes", () => {
    let s = startGame(3);
    expect(s.public.turn).toBe(1);
    s = playAnswers(s, 3);
    expect(s.public.turn).toBe(1);
    s = playAnswers(s, 1);
    expect(s.public.turn).toBe(2);
    s = playAnswers(s, 4);
    expect(s.public.turn).toBe(3);
  });
  it("after rounds x 4 answers the game is over with reason placeholderFinished and no winner", () => {
    for (const rounds of [1, 2, 4]) {
      const almost = playAnswers(startGame(rounds), rounds * 4 - 1);
      expect(almost.public.status).toEqual({ kind: "active" });
      const over = playAnswers(almost, 1);
      expect(over.public.status).toEqual({ kind: "over", winner: null, reason: "placeholderFinished" });
      expect(over.public.pending).toEqual([]);
    }
  });
});
