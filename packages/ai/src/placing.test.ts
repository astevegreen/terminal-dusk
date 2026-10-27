// Easy answers the action menu's place influence (A11b, issue #360): the menu, then one placeInfluence decision per
// influence (R16a). Easy answers both through legalAnswers; these tests play whole map games through them.
import { controller, legalAnswers, viewFor } from "@terminal-dusk/engine";
import type { Answer, AnswerValue, CountryId, GameEvent, PlaceOptions, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { seededRandom } from "./random.ts";
import { escalationRuleset, newMapGame, newPointsMapGame, pointsRuleset } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const MAP_GAMES = 50;
const POINTS_GAMES = 20;
/** The random seeds Easy is asked again with at a placing where a country costs more than the points left. */
const RETRIES = 5;

const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** What one influence in `country` costs `side` now: 2 where the rival controls it, otherwise 1. */
const costIn = (state: TestState, side: Side, country: CountryId): number =>
  controller(state.public, country) === rivalOf(side) ? 2 : 1;

/** A placing `side` was asked: the state it was asked in and the decision's options. */
type Placing = { state: TestState; side: Side; options: PlaceOptions };

type Played = {
  finals: TestState[];
  /** Every answer given, with the state it answered. */
  answers: { before: TestState; value: AnswerValue }[];
  /** Every placing answered, with the state after it and its influencePlaced event. */
  placings: (Placing & { after: TestState; placed: Extract<GameEvent, { kind: "influencePlaced" }> })[];
  /** Per game, the sides of its pointsSpent events of 1 point (the "both get 1" lines), in order. */
  spent: Side[][];
};

const valueOf = (answer: Answer): AnswerValue | null => ("value" in answer ? answer.value : null);

/** The placeInfluence decision pending for `side` in `state`, or null. */
function placingFor(state: TestState, side: Side): Placing | null {
  const decision = state.public.pending.find((d) => d.side === side && d.kind === "placeInfluence");
  if (decision === undefined || !("countries" in decision.options)) return null;
  return { state, side, options: decision.options as PlaceOptions };
}

/** Plays games from `start(seed)` for seeds 1 to `games` with Easy on both sides (playEasy checks every answer). */
function playAll(rules: typeof pointsRuleset, start: (seed: number) => TestState, games: number): Played {
  const into: Played = { finals: [], answers: [], placings: [], spent: [] };
  for (let seed = 1; seed <= games; seed++) {
    const spent: Side[] = [];
    const final = playEasy(rules, start(seed), EASY_WEIGHTS, seededRandom(seed), {
      name: `${rules.id} game ${seed}`,
      applied: (before, after, events, answer) => {
        for (const e of events) if (e.kind === "pointsSpent" && e.amount === 1) spent.push(e.side);
        const value = valueOf(answer);
        if (value === null) return;
        into.answers.push({ before, value });
        const placing =
          value.kind === "placeInfluence" && answer.side !== "both" ? placingFor(before, answer.side) : null;
        const placed = events.find((e) => e.kind === "influencePlaced");
        if (placing !== null && placed?.kind === "influencePlaced") into.placings.push({ ...placing, after, placed });
      },
    });
    into.finals.push(final);
    into.spent.push(spent);
  }
  return into;
}

let mapCache: Played | null = null;
/** The 50 seeded A11a map games, played once and shared by the tests below. */
const mapGames = (): Played => (mapCache ??= playAll(escalationRuleset, (seed) => newMapGame(seed), MAP_GAMES));

let pointsCache: Played | null = null;
/** The 20 seeded event-points map games, played once. */
const pointsGames = (): Played =>
  (pointsCache ??= playAll(pointsRuleset, (seed) => newPointsMapGame(seed), POINTS_GAMES));

describe("Easy answers the action menu's place influence (A11b)", () => {
  it("Easy places in the map games: it picks place, answers placings legally, and every game ends", () => {
    const { finals, answers, placings } = mapGames();
    expect(finals).toHaveLength(MAP_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    const pickedPlace = answers.filter(({ value }) => value.kind === "chooseAction" && value.action === "place");
    expect(pickedPlace.length).toBeGreaterThan(0);
    expect(placings.length).toBeGreaterThan(0);
    // Decision 8: one influence per answer, in a country of the play's fixed list.
    for (const { options, placed } of placings) expect(options.countries).toContain(placed.country);
  });

  it("Easy never names a country it cannot afford", () => {
    const tight = mapGames().placings.filter(({ state, side, options }) =>
      options.countries.some((country) => costIn(state, side, country) > options.points),
    );
    expect(tight.length).toBeGreaterThan(0);
    for (const { state, side, options } of tight) {
      for (let seed = 1; seed <= RETRIES; seed++) {
        const value = easyAnswer(escalationRuleset, viewFor(state, side), side, EASY_WEIGHTS, seededRandom(seed));
        expect(value?.kind).toBe("placeInfluence");
        if (value?.kind !== "placeInfluence") continue;
        expect(costIn(state, side, value.country)).toBeLessThanOrEqual(options.points);
        expect(legalAnswers(escalationRuleset, state, side)).toContainEqual(value);
      }
    }
  });

  it("a placement costing 2 is seen, in a country the rival controlled just before it", () => {
    const twos = mapGames().placings.filter(({ placed }) => placed.cost === 2);
    expect(twos.length).toBeGreaterThan(0);
    for (const { state, side, placed } of twos) expect(controller(state.public, placed.country)).toBe(rivalOf(side));
  });

  it("a play's points are spent while a placement is affordable", () => {
    const ended = mapGames().placings.filter(({ after, side, options, placed }) => {
      const next = placingFor(after, side);
      return next === null || next.options.points !== options.points - placed.cost;
    });
    expect(ended.length).toBeGreaterThan(0);
    for (const { after, side, options, placed } of ended) {
      const left = options.points - placed.cost;
      for (const country of options.countries) expect(costIn(after, side, country)).toBeGreaterThan(left);
    }
  });

  it("event points are placed too: both sides place, each card's line asks LIO then SAE, and every game ends", () => {
    const { finals, placings, spent } = pointsGames();
    expect(finals).toHaveLength(POINTS_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    expect(placings.some(({ side }) => side === "lio")).toBe(true);
    expect(placings.some(({ side }) => side === "sae")).toBe(true);
    for (const sides of spent) {
      expect(sides.length).toBeGreaterThan(0);
      expect(sides).toEqual(sides.map((_, i) => (i % 2 === 0 ? "lio" : "sae")));
    }
  });
});
