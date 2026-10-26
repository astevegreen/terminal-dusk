import { describe, expect, it } from "vitest";
import { seededRandom } from "../random.ts";
import { EASY_WEIGHTS } from "../weights/easy.ts";
import { playEasy } from "./playEasy.ts";
import { newGame, ruleset } from "./testGames.ts";

/** How many answers seed 3's game takes when Easy plays it with no tight limit. */
function answersToEnd(): number {
  let answers = 0;
  playEasy(ruleset, newGame(3), EASY_WEIGHTS, seededRandom(3), { applied: () => answers++ });
  return answers;
}

describe("playEasy's answer limit", () => {
  it("a game longer than the limit throws the did not end error", () => {
    const answers = answersToEnd();
    expect(answers).toBeGreaterThan(1);
    expect(() =>
      playEasy(ruleset, newGame(3), EASY_WEIGHTS, seededRandom(3), { name: "seed 3", mostAnswers: answers - 1 }),
    ).toThrow("seed 3 did not end");
  });

  it("a game that ends exactly on the limit's last answer does not throw", () => {
    const answers = answersToEnd();
    const final = playEasy(ruleset, newGame(3), EASY_WEIGHTS, seededRandom(3), { mostAnswers: answers });
    expect(final.public.status.kind).toBe("over");
  });
});
