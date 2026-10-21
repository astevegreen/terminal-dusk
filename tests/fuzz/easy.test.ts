// The Easy AI inside the fuzz suite (#91): every third game has it on one side, with every invariant checked.
import { SIDES } from "@terminal-dusk/engine";
import type { Answer, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyChooser, playFuzzGame, playGame, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";

type Final = ReturnType<typeof playGame>["final"];

const finalsBySide = new Map<Side, Final[]>();
/** The last states of fuzz games 1-20 with Easy as `easy`, each played with every check; played once per side. */
function easyFinals(easy: Side): Final[] {
  const known = finalsBySide.get(easy);
  if (known !== undefined) return known;
  const finals = Array.from({ length: 20 }, (_, i) => {
    const rng = seededRng(i + 1);
    const { setup, seed } = randomGame(rng, i + 1);
    return playGame(ruleset, `Easy as ${easy}, game ${i + 1}`, setup, seed, easyChooser(ruleset, easy, rng)).final;
  });
  finalsBySide.set(easy, finals);
  return finals;
}

describe("Easy in the fuzz games", () => {
  it("plays games 0, 6, 12 as LIO and 3, 9, 15 as SAE, and every one of them ends", () => {
    for (const game of [0, 3, 6, 9, 12, 15]) {
      expect(playFuzzGame(game).final.public.status.kind).toBe("over");
    }
  });

  it("answers its own side's decisions with the AI on either side, and the game still passes every check", () => {
    for (const easy of SIDES) {
      const finals = easyFinals(easy);
      expect(finals).toHaveLength(20);
      for (const final of finals) expect(final.public.status.kind).toBe("over");
    }
  });

  it("reaches the lasting markers of R4b's cards: as each side, at least one Easy game ends with markers set", () => {
    for (const easy of SIDES) {
      const marked = easyFinals(easy).filter((f) => f.public.status.kind === "over" && f.public.markers.length > 0);
      expect(marked.length, `Easy as ${easy}`).toBeGreaterThan(0);
    }
  });

  it("does not always answer first in the simultaneous opening pick", () => {
    const firstSides = new Set<Side>();
    for (let game = 1; game <= 30; game++) {
      const rng = seededRng(game);
      const { setup, seed } = randomGame(rng, game);
      const answers: Answer[] = playGame(
        ruleset,
        `Easy as lio, game ${game}`,
        setup,
        seed,
        easyChooser(ruleset, "lio", rng),
      ).record.answers;
      firstSides.add(answers[0]!.side);
    }
    expect(firstSides.size).toBe(2);
  });
});
