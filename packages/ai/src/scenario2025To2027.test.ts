// Easy with the real cards in the optional 2025-2027 game (#601): seeded games, both sides Easy, end to end, so the
// future cards that enter on turn 11 are played by the AI too.
import { FIRST_DECK_RULESET, FUTURE_CARDS } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { seededRandom } from "./random.ts";
import { newScenario2025To2027Game } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 8;
const FUTURE_IDS = new Set(FUTURE_CARDS.map((card) => card.id));

type Played = { finals: TestState[]; futurePlayed: Set<string> };

let cached: Played | null = null;
/** The seeded games, played once: every game's last state and every future card an answer played. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], futurePlayed: new Set() };
  for (let seed = 1; seed <= GAMES; seed++) {
    into.finals.push(
      playEasy(FIRST_DECK_RULESET, newScenario2025To2027Game(seed), EASY_WEIGHTS, seededRandom(seed), {
        name: `2025-2027 game ${seed}`,
        mostAnswers: 2000,
        applied: (_before, _after, _events, answer) => {
          const value = "value" in answer ? answer.value : null;
          if (value?.kind === "playCardAs" && FUTURE_IDS.has(value.card)) into.futurePlayed.add(value.card);
        },
      }),
    );
  }
  cached = into;
  return into;
}

describe("Easy with the real cards in the 2025-2027 game", () => {
  it("starts on the six-region map with 11 turns", () => {
    const { map, status, turn } = newScenario2025To2027Game(1).public;
    expect(status.kind).toBe("active");
    expect(turn).toBe(1);
    expect(map?.regions).toHaveLength(6);
  });

  it(`plays ${GAMES} seeded games on both sides with only legal answers; each runs to turn 11 unless a side reaches the track end`, () => {
    const finals = played().finals;
    for (const final of finals) {
      const { status, turn } = final.public;
      expect(status.kind).toBe("over");
      expect(turn).toBeLessThanOrEqual(11);
      if (status.kind === "over" && status.reason !== "trackEnd") expect(turn).toBe(11);
    }
    expect(finals.some((final) => final.public.turn === 11)).toBe(true);
  }, 120_000);

  it("plays at least one future card across the games", () => {
    expect(played().futurePlayed.size).toBeGreaterThan(0);
  }, 120_000);
});
