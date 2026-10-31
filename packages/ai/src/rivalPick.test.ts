// A guess fills in the rival's secret opening pick (A18, issue #507), so a rebuilt state can go on past it. Before
// this, a side that picked second searched a state waiting forever on the first pick, and Hard looked no further.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { apply, legalAnswers, reconstruct, viewFor } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { guessHidden, withRivalPick } from "./guess.ts";
import { seededRandom } from "./random.ts";
import { rollout } from "./rollout.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { applyTo } from "./test/testGames.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const rules = FIRST_DECK_RULESET;

/** A six-region game's opening, and the same game once LIO has picked its card in secret. */
function opening(seed: number) {
  const start = newSixRegionMapGame(seed);
  const lio = start.public.pending.find((d) => d.side === "lio")!;
  const value = legalAnswers(rules, start, "lio")[0]!;
  const picked = applyTo(rules, start, { decisionId: lio.id, side: "lio", value }).state;
  return { start, lio, picked };
}

describe("withRivalPick", () => {
  it("guesses a card from the rival's guessed hand under the rival's real decision, once the rival has picked", () => {
    const { lio, picked } = opening(3);
    const view = viewFor(picked, "sae");
    const hidden = guessHidden(rules, view, "sae", seededRandom(1));
    const guessed = withRivalPick(hidden, view, "sae", seededRandom(2));
    expect(guessed.opponent.picks).toHaveLength(1);
    const pick = guessed.opponent.picks[0]!;
    expect(pick.decisionId).toBe(lio.id);
    expect(pick.group).toBe(lio.simultaneousGroup);
    expect(pick.value.kind).toBe("chooseCard");
    expect(hidden.opponent.hand).toContain(pick.value.kind === "chooseCard" ? pick.value.card : "");
  });

  it("leaves the guess as it was while the rival still has to pick", () => {
    const { start } = opening(3);
    const view = viewFor(start, "sae");
    const hidden = guessHidden(rules, view, "sae", seededRandom(1));
    expect(withRivalPick(hidden, view, "sae", seededRandom(2))).toEqual(hidden);
  });

  it("lets the side picking second answer on the rebuilt state and play on past the reveal", () => {
    for (const seed of [3, 4, 5]) {
      const { picked } = opening(seed);
      const view = viewFor(picked, "sae");
      const state = reconstruct(
        view,
        withRivalPick(guessHidden(rules, view, "sae", seededRandom(1)), view, "sae", seededRandom(2)),
      );
      const sae = state.public.pending.find((d) => d.side === "sae")!;
      const answer = legalAnswers(rules, state, "sae")[0]!;
      const after = apply(rules, state, { decisionId: sae.id, side: "sae", value: answer });
      expect(after.ok).toBe(true);
      expect(after.ok && after.value.state.public.pending.length).toBeGreaterThan(0);
      expect(rollout(rules, state, "sae", answer, MEDIUM_WEIGHTS, 1, seededRandom(4)).steps).toBeGreaterThan(0);
    }
  });
});
