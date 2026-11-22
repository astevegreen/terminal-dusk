// The optional 2025-2027 game with the real cards (#601): random games and Easy-against-random games from the
// host's config, so the future cards (turn 11) meet every fuzz check at every step. The suite fails if no game
// plays a future card.
import { FIRST_DECK_RULESET, FUTURE_CARDS } from "@terminal-dusk/content/first-deck";
import { easyChooser, randomChooser, playGame } from "./play.ts";
import { scenario2025To2027Config } from "@terminal-dusk/host/first-deck";
import { seedHash } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { mapGameCount } from "./play.ts";
import type { Played } from "./play.ts";
import { seededRng } from "./random.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// A fifth of FUZZ_GAMES but at most as many as is useful here: a real-card game is many times slower than a fuzz one.
const GAMES = Math.min(mapGameCount(process.env["FUZZ_GAMES"]), 40);
const FUTURE_IDS = new Set(FUTURE_CARDS.map((card) => card.id));

/** Game `game`: the host's 2025-2027 config, every third game with Easy on one side, as playFuzzGame does. */
function playFutureGame(game: number): Played {
  const rng = seededRng(game);
  const { setup } = scenario2025To2027Config();
  const seed = `future-${game}`;
  const easy = game % 3 === 0 ? "lio" : game % 3 === 1 ? "sae" : null;
  const choose = easy === null ? randomChooser(FIRST_DECK_RULESET, rng) : easyChooser(FIRST_DECK_RULESET, easy, rng);
  const label = `2025-2027 game ${game} (playFutureGame(${game}) plays it again)`;
  return playGame(FIRST_DECK_RULESET, label, { ...setup, seedHash: seedHash(seed) }, seed, choose);
}

describe("random games of the 2025-2027 scenario with the real cards", () => {
  it(
    `plays ${GAMES} games to the end (some stop early at a track end), some play a future card, and every check holds at every step`,
    () => {
      let withFuture = 0;
      for (let game = 1; game <= GAMES; game++) {
        const { record, final } = playFutureGame(game);
        expect(final.public.status.kind).toBe("over");
        expect(final.public.turn).toBeLessThanOrEqual(11);
        const playedFuture = record.answers.some(
          (a) => "value" in a && a.value.kind === "playCardAs" && FUTURE_IDS.has(a.value.card),
        );
        if (playedFuture) withFuture++;
      }
      expect(withFuture).toBeGreaterThan(0);
    },
    Math.max(300_000, GAMES * 5000),
  );
});
