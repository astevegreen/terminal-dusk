// The steps real cards use that the base fuzz cards leave out (extraSteps.ts): discardFromHand in its three forms,
// escalate up and down, addToNumber and the atLeast, atMost and equals tests. Random games with them, half on the
// content test map (where Escalation moves), run every check at every step, and reach every kind and branch.
import { describe, expect, it } from "vitest";
import { announcedExtra, EXTRA_KINDS, extraStepsRuleset, withDiscardRoom } from "./extraSteps.ts";
import type { ExtraKind } from "./extraSteps.ts";
import { mapGameCount, playGame, randomChooser, randomGame } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { seededRng } from "./random.ts";
import { onTestMap } from "./testMap.ts";
import { eventsOf } from "./replayEvents.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

const GAMES = mapGameCount(process.env["FUZZ_GAMES"]);

type Counts = Record<ExtraKind | "cardsDiscarded" | "escalationChanged", number>;

/**
 * Extra-steps game `game`: fuzz game `game`'s setup with room in the hands for the discards (withDiscardRoom), on the
 * test map when `game` is even, played at random.
 */
function playExtraGame(game: number): GameRecord {
  const rng = seededRng(game);
  const { setup: base, seed } = randomGame(rng, game);
  const setup = withDiscardRoom(base);
  const label = `Extra-steps game ${game} (playExtraGame(${game}) in extraSteps.test.ts plays it again)`;
  const chooser = randomChooser(extraStepsRuleset, rng);
  return playGame(extraStepsRuleset, label, game % 2 === 0 ? onTestMap(setup) : setup, seed, chooser).record;
}

describe("the extra steps in random games", () => {
  it("every extra step kind is on LIO, SAE and neutral cards", () => {
    for (const kind of EXTRA_KINDS.filter((k) => !k.includes(":then") && !k.includes(":else"))) {
      const on = extraStepsRuleset.cards.filter((card) =>
        card.effect.some((step) => step.op === "marker" && step.label === `extra:${kind}`),
      );
      expect(new Set(on.map((card) => card.affiliation)), kind).toEqual(new Set(["lio", "sae", "neutral"]));
    }
  });

  it(
    `plays ${GAMES} games to the end, every check at every step, and reaches every extra step and branch`,
    () => {
      const counts = Object.fromEntries(
        [...EXTRA_KINDS, "cardsDiscarded", "escalationChanged"].map((k) => [k, 0]),
      ) as Counts;
      for (let game = 1; game <= GAMES; game++) {
        // playGame runs every check on every step and throws with the game's record if one fails.
        for (const event of eventsOf(extraStepsRuleset, playExtraGame(game))) {
          const kind = announcedExtra(event);
          if (kind !== null) counts[kind]++;
          if (event.kind === "cardsDiscarded" || event.kind === "escalationChanged") counts[event.kind]++;
        }
      }
      for (const [what, n] of Object.entries(counts)) expect(n, what).toBeGreaterThan(0);
    },
    Math.max(120_000, GAMES * 300),
  );
});
