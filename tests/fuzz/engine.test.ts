// Fuzz suite: plays FUZZ_GAMES random placeholder games and checks invariants 1, 4, 5 and 6 of
// docs/architecture.md ("Guardrails", "Fuzz suite") at every step. See tests/fuzz/play.ts.
import { describe, expect, it } from "vitest";
import { FIXED_GAMES } from "./fixedGames.ts";
import { gameCount, playFuzzGame, playRecorded } from "./play.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

const GAMES = gameCount(process.env["FUZZ_GAMES"]);

describe("engine fuzz suite", () => {
  it(
    `plays ${GAMES} random games to the end, each with its own seed, and every invariant holds at every step`,
    () => {
      // playFuzzGame throws, with the game's record, when an invariant fails.
      let finished = 0;
      for (let game = 1; game <= GAMES; game++) {
        if (playFuzzGame(game).final.public.status.kind === "over") finished++;
      }
      expect(finished).toBe(GAMES);
    },
    // About 1.5 ms per game here; the margin covers slower machines. A failure stops at the first failing game.
    Math.max(30_000, GAMES * 20),
  );

  it.each(FIXED_GAMES)("replays every answer of the fixed game $name with every check", ({ name, record }) => {
    expect(playRecorded(name, record).record.answers).toHaveLength(record.answers.length);
  });
});
