// The map and influence in the fuzz games (R15): the influence check (influenceChecks.ts) catches what it should,
// and random games started with the content test map (TEST_MAP_SCENARIO) run it, with every other check, on
// every step.
import { scenarioSetup, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import { createGame } from "@terminal-dusk/engine";
import type { GameState, PublicState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkInfluence } from "./checks.ts";
import { gameCount, playGame, randomChooser, randomGame, ruleset } from "./play.ts";
import type { Played } from "./play.ts";
import { seededRng } from "./random.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// Capped, as neutral.test.ts is: these games run every check, the map's included, and take longer than engine.test.ts's.
const GAMES = Math.min(gameCount(process.env["FUZZ_GAMES"]), 200);

/** A fresh copy of the content test map, as a Setup's `map`. */
const testMap = (): NonNullable<Setup["map"]> => scenarioSetup(TEST_MAP_SCENARIO).map!;

/** Map game `game`: fuzz game `game`'s random setup with the content test map, played by the random chooser. */
function playMapGame(game: number): Played {
  const rng = seededRng(game);
  const { setup, seed } = randomGame(rng, game);
  const label = `Map game ${game} (playMapGame(${game}) plays it again)`;
  return playGame(ruleset, label, { ...setup, map: testMap() }, seed, randomChooser(ruleset, rng));
}

/** The state createGame makes from fuzz game 1's setup, with the test map unless `withMap` is false. */
function started(withMap = true): { setup: Setup; state: GameState } {
  const { setup: base, seed } = randomGame(seededRng(1), 1);
  const setup = withMap ? { ...base, map: testMap() } : base;
  const r = createGame(ruleset, setup, seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return { setup, state: r.value.state };
}

const withPublic = (state: GameState, change: Partial<PublicState>): GameState => ({
  ...state,
  public: { ...state.public, ...change },
});

describe("the influence check", () => {
  it("passes a new game with the test map, and one without a map", () => {
    const withMap = started();
    expect(withMap.state.public.influence!.length).toBeGreaterThan(0);
    expect(() => checkInfluence(withMap.setup, withMap.state)).not.toThrow();
    const noMap = started(false);
    expect(() => checkInfluence(noMap.setup, noMap.state)).not.toThrow();
  });

  it("fails a negative count or one that is not a whole number", () => {
    const { setup, state } = started();
    for (const bad of [-1, 0.5, Number.NaN]) {
      const influence = state.public.influence!.map((e, i) => (i === 0 ? { ...e, sae: bad } : e));
      expect(() => checkInfluence(setup, withPublic(state, { influence }))).toThrow(/not a whole number 0 or more/);
    }
  });

  it("fails an influence list with a country missing, one twice, or out of the map's order", () => {
    const { setup, state } = started();
    const list = state.public.influence!;
    for (const influence of [list.slice(1), [...list, list[0]!], [...list].reverse()]) {
      expect(() => checkInfluence(setup, withPublic(state, { influence }))).toThrow(/one entry per map country/);
    }
  });

  it("fails an influence entry with an extra field", () => {
    const { setup, state } = started();
    const influence = state.public.influence!.map((e, i) => (i === 0 ? { ...e, extra: 1 } : e));
    expect(() => checkInfluence(setup, withPublic(state, { influence }))).toThrow(/has the fields/);
  });

  it("fails a map that has changed from the setup's", () => {
    const { setup, state } = started();
    const map = state.public.map!;
    const changed = { ...map, countries: map.countries.map((c, i) => (i === 0 ? { ...c, stability: 9 } : c)) };
    expect(() => checkInfluence(setup, withPublic(state, { map: changed }))).toThrow(/is not the setup's map/);
  });

  it("fails a game started without a map that has a map or an influence list", () => {
    const { setup, state } = started(false);
    const withMap = started();
    expect(() => checkInfluence(setup, withPublic(state, { map: withMap.state.public.map! }))).toThrow(/`map`/);
    expect(() => checkInfluence(setup, withPublic(state, { influence: [] }))).toThrow(/`influence`/);
  });
});

describe("random games with the content test map", () => {
  it(`plays ${GAMES} random games with TEST_MAP_SCENARIO's map to the end, and every check holds at every step`, () => {
    let finished = 0;
    for (let game = 1; game <= GAMES; game++) {
      const { final } = playMapGame(game);
      expect(final.public.influence!.map((e) => e.country)).toEqual(testMap().countries.map((c) => c.id));
      if (final.public.status.kind === "over") finished++;
    }
    expect(finished).toBe(GAMES);
  }, 120_000);
});
