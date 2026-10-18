// The Easy AI inside the fuzz suite (#91): every third game has it on one side, with every invariant checked.
import { SIDES } from "@terminal-dusk/engine";
import type { Answer, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyChooser, playFuzzGame, playGame, randomGame } from "./play.ts";
import { seededRng } from "./random.ts";

describe("Easy in the fuzz games", () => {
  it("plays games 0, 6, 12 as LIO and 3, 9, 15 as SAE, and every one of them ends", () => {
    for (const game of [0, 3, 6, 9, 12, 15]) {
      expect(playFuzzGame(game).final.public.status.kind).toBe("over");
    }
  });

  it("answers its own side's decisions with the AI on either side, and the game still passes every check", () => {
    for (const easy of SIDES) {
      for (let game = 1; game <= 20; game++) {
        const rng = seededRng(game);
        const { setup, seed } = randomGame(rng, game);
        const played = playGame(`Easy as ${easy}, game ${game}`, setup, seed, easyChooser(easy, rng));
        expect(played.final.public.status.kind).toBe("over");
      }
    }
  });

  it("does not always answer first in the simultaneous opening pick", () => {
    const firstSides = new Set<Side>();
    for (let game = 1; game <= 30; game++) {
      const rng = seededRng(game);
      const { setup, seed } = randomGame(rng, game);
      const answers: Answer[] = playGame(`Easy as lio, game ${game}`, setup, seed, easyChooser("lio", rng)).record
        .answers;
      firstSides.add(answers[0]!.side);
    }
    expect(firstSides.size).toBe(2);
  });
});
