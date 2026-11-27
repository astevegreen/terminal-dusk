// Hard as SAE and LIO's secret opening pick (issue #694). The arena takes LIO's answer first, so Hard as SAE always
// opens a turn with LIO's pick made and hidden. Before #694 Hard guessed it at random from LIO's guessed hand, while
// as LIO it met SAE's pick in its rollouts made by Medium: SAE's search planned against a rival picking blind.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { hiddenPart, legalAnswers, viewFor } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { guessHidden } from "./guess.ts";
import { mediumAnswer } from "./medium.ts";
import { withMediumRivalPick } from "./openingGuess.ts";
import { seededRandom } from "./random.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { applyTo } from "./test/testGames.ts";
import { HARD_WEIGHTS } from "./weights/hard.ts";

const rules = FIRST_DECK_RULESET;
const QUIET = { ...HARD_WEIGHTS, noise: 0 };

/** A six-region game's opening, the same game once LIO has made Medium's pick in secret, and that pick. */
function opening(seed: number) {
  const start = newSixRegionMapGame(seed);
  const lio = start.public.pending.find((d) => d.side === "lio")!;
  const choice = mediumAnswer(rules, viewFor(start, "lio"), "lio", QUIET, seededRandom(seed))!;
  const picked = applyTo(rules, start, { decisionId: lio.id, side: "lio", value: choice }).state;
  return { start, lio, choice, picked };
}

describe("Hard's guess of the rival's secret opening pick", () => {
  it("as SAE, with LIO's hand guessed right, guesses the pick Medium makes from LIO's own view, whatever the luck", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { start, lio, choice, picked } = opening(seed);
      const view = viewFor(picked, "sae");
      // SAE's guess with LIO's real hand (its pick not yet known) and a guessed deck.
      const guess = guessHidden(rules, view, "sae", seededRandom(seed));
      const real = hiddenPart(start, "sae").opponent;
      const hidden = { ...guess, opponent: { ...real, picks: [] } };
      expect(legalAnswers(rules, start, "lio").length).toBeGreaterThan(1);
      for (let luck = 1; luck <= 6; luck++) {
        const guessed = withMediumRivalPick(rules, hidden, view, "sae", HARD_WEIGHTS, seededRandom(luck));
        expect(guessed.opponent.picks).toEqual([{ group: lio.simultaneousGroup, decisionId: lio.id, value: choice }]);
      }
    }
  });

  it("leaves the guess as it was while the rival still has to pick", () => {
    const { start } = opening(3);
    const view = viewFor(start, "sae");
    const hidden = guessHidden(rules, view, "sae", seededRandom(1));
    expect(withMediumRivalPick(rules, hidden, view, "sae", HARD_WEIGHTS, seededRandom(2))).toEqual(hidden);
  });
});
