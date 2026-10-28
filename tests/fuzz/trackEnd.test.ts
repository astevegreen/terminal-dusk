// Games that end at a score track's end (R23). The map fuzz suite (influence.test.ts) plays the content test map,
// whose long track only a few of its games reach, and nothing there asserts that any do. These games use the same
// map with a short track, so most end at an end: the suite fails if none does, and every check still holds at every
// step of them.
import type { Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { gameCount, playGame, randomChooser, randomGame, ruleset } from "./play.ts";
import type { Played } from "./play.ts";
import { seededRng } from "./random.ts";
import { onTestMap } from "./testMap.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// Capped, as influence.test.ts is: these games run every check, the map's included.
const GAMES = Math.min(gameCount(process.env["FUZZ_GAMES"]), 200);

/** The short track: each side's end is 2 points from the middle, where the game starts. */
const SHORT_END = 2;

/** `setup` on the content test map (onTestMap), with its score track cut to SHORT_END. */
function onShortTrack(setup: Setup): Setup {
  const mapped = onTestMap(setup);
  const map = mapped.map!;
  return { ...mapped, map: { ...map, scoring: { ...map.scoring!, track: { end: SHORT_END, start: 0 } } } };
}

/** Short-track game `game`: fuzz game `game`'s random setup on the short track, played by the random chooser. */
function playShortTrackGame(game: number): Played {
  const rng = seededRng(game);
  const { setup, seed } = randomGame(rng, game);
  const label = `Short-track game ${game} (playShortTrackGame(${game}) plays it again)`;
  return playGame(ruleset, label, onShortTrack(setup), seed, randomChooser(ruleset, rng));
}

describe("random games on the test map with a short score track", () => {
  it(`plays ${GAMES} random games to the end, some end at a track end, and every check holds at every step`, () => {
    let atEnd = 0;
    for (let game = 1; game <= GAMES; game++) {
      const { final } = playShortTrackGame(game);
      const { status, score } = final.public;
      expect(status.kind).toBe("over");
      expect(Math.abs(score!)).toBeLessThanOrEqual(SHORT_END);
      if (status.kind !== "over" || status.reason !== "trackEnd") continue;
      atEnd++;
      // The game stopped where it ended: on the winner's end, with nothing left waiting.
      expect(score).toBe(status.winner === "lio" ? -SHORT_END : SHORT_END);
      expect(final.public.pending).toEqual([]);
      expect(final.public.stack).toEqual([]);
    }
    expect(atEnd).toBeGreaterThan(0);
  }, 120_000);
});
