// Easy with the real first deck on the six-region map (A14, issue #439): seeded games, both sides Easy, end to end.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { seededRandom } from "./random.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 5;

type Played = { finals: TestState[]; placedIn: Set<string> };

let cached: Played | null = null;
/** The seeded games, played once: every game's last state and every country an answer placed influence in. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], placedIn: new Set() };
  for (let seed = 1; seed <= GAMES; seed++) {
    const final = playEasy(FIRST_DECK_RULESET, newSixRegionMapGame(seed), EASY_WEIGHTS, seededRandom(seed), {
      name: `six-region map game ${seed}`,
      applied: (_before, _after, _events, answer) => {
        const value = "value" in answer ? answer.value : null;
        if (value?.kind === "placeInfluence") into.placedIn.add(value.country);
      },
    });
    into.finals.push(final);
  }
  cached = into;
  return into;
}

describe("Easy with the real first deck on the six-region map", () => {
  it("the games start on the six-region map: 6 regions, 42 countries and the starting influence", () => {
    const { map, influence, status } = newSixRegionMapGame(1).public;
    expect(status.kind).toBe("active");
    expect(map?.regions).toHaveLength(6);
    expect(map?.countries).toHaveLength(42);
    expect(influence).toEqual(expect.arrayContaining([expect.objectContaining({ country: "taiwan", lio: 3, sae: 0 })]));
  });

  it(`plays ${GAMES} seeded games on both sides with only legal answers, and every game ends`, () => {
    const { finals } = played();
    expect(finals).toHaveLength(GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
  });

  it("the AI places influence on the six-region map, not only on the test map's countries", () => {
    const { placedIn } = played();
    expect(placedIn.size).toBeGreaterThan(0);
    const countries = new Set(newSixRegionMapGame(1).public.map?.countries.map((c) => c.id));
    for (const country of placedIn) expect(countries.has(country)).toBe(true);
  });
});
