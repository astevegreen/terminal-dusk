// Easy answers the action menu's intervene (A11c, issue #371): one chooseAction answer per country open to an
// intervention (R16b). Easy answers it through legalAnswers; these tests play whole map games through it.
import { isRegionClosed, legalAnswers, viewFor } from "@terminal-dusk/engine";
import type { ActionOptions, Answer, AnswerValue, CountryId, GameEvent, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { seededRandom } from "./random.ts";
import { escalationRuleset, newMapGame, newPointsMapGame, pointsRuleset } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const MAP_GAMES = 50;
const POINTS_GAMES = 20;
/** The random seeds Easy is asked again with at a menu that offers an intervention. */
const RETRIES = 5;

const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** `side`'s influence in `country` in `state`. */
const influenceOf = (state: TestState, side: Side, country: CountryId): number =>
  state.public.influence?.find((e) => e.country === country)?.[side] ?? 0;

/** An action menu `side` was asked: the state it was asked in and the decision's options. */
type Menu = { state: TestState; side: Side; options: ActionOptions };

type Intervention = Menu & {
  country: CountryId;
  after: TestState;
  event: Extract<GameEvent, { kind: "intervened" }>;
};

type Played = { finals: TestState[]; menus: Menu[]; interventions: Intervention[] };

/** The chooseAction decision pending for `side` in `state`, or null. */
function menuFor(state: TestState, side: Side): Menu | null {
  const decision = state.public.pending.find((d) => d.side === side && d.kind === "chooseAction");
  if (decision === undefined || !("actions" in decision.options)) return null;
  return { state, side, options: decision.options as ActionOptions };
}

const valueOf = (answer: Answer): AnswerValue | null => ("value" in answer ? answer.value : null);

/** Plays games from `start(seed)` for seeds 1 to `games` with Easy on both sides (playEasy checks every answer). */
function playAll(rules: typeof pointsRuleset, start: (seed: number) => TestState, games: number): Played {
  const into: Played = { finals: [], menus: [], interventions: [] };
  for (let seed = 1; seed <= games; seed++) {
    const final = playEasy(rules, start(seed), EASY_WEIGHTS, seededRandom(seed), {
      name: `${rules.id} game ${seed}`,
      applied: (before, after, events, answer) => {
        const value = valueOf(answer);
        if (value?.kind !== "chooseAction" || answer.side === "both") return;
        const menu = menuFor(before, answer.side);
        if (menu === null) return;
        into.menus.push(menu);
        if (value.action !== "intervene") return;
        const event = events.find((e) => e.kind === "intervened");
        if (event?.kind === "intervened") into.interventions.push({ ...menu, country: value.country, after, event });
        else throw new Error(`${rules.id} game ${seed}: an intervene answer made no intervened event`);
      },
    });
    into.finals.push(final);
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

describe("Easy answers the action menu's intervene (A11c)", () => {
  it("Easy intervenes in the map games: one intervention per pick, with the menu's points, and every game ends", () => {
    const { finals, interventions } = mapGames();
    expect(finals).toHaveLength(MAP_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    expect(interventions.length).toBeGreaterThan(0);
    for (const { side, options, country, event } of interventions) {
      expect(options.targets).toContain(country);
      expect(event).toMatchObject({ side, country, points: options.points });
    }
  });

  it("Easy intervenes only where the rival has influence and the region is open", () => {
    const offered = mapGames().menus.filter(({ options }) => options.actions.includes("intervene"));
    expect(offered.length).toBeGreaterThan(0);
    for (const { state, side } of offered) {
      for (let seed = 1; seed <= RETRIES; seed++) {
        const value = easyAnswer(escalationRuleset, viewFor(state, side), side, EASY_WEIGHTS, seededRandom(seed));
        expect(value?.kind).toBe("chooseAction");
        expect(legalAnswers(escalationRuleset, state, side)).toContainEqual(value);
        if (value?.kind !== "chooseAction" || value.action !== "intervene") continue;
        expect(influenceOf(state, rivalOf(side), value.country)).toBeGreaterThan(0);
        const region = state.public.map!.countries.find((c) => c.id === value.country)!.region;
        expect(isRegionClosed(state.public, region)).toBe(false);
      }
    }
  });

  it("an intervention moves influence by draw + points - 2 x stability, and both outcomes are seen", () => {
    const { interventions } = mapGames();
    for (const { state, after, side, country, options, event } of interventions) {
      const stability = state.public.map!.countries.find((c) => c.id === country)!.stability;
      expect(event.stability).toBe(stability);
      expect(event.result).toBe(event.draw + options.points - 2 * stability);
      const rivalHad = influenceOf(state, rivalOf(side), country);
      const gain = Math.max(0, event.result);
      expect(event.removed).toBe(Math.min(gain, rivalHad));
      expect(event.added).toBe(gain - event.removed);
      expect(influenceOf(after, rivalOf(side), country)).toBe(rivalHad - event.removed);
      expect(influenceOf(after, side, country)).toBe(influenceOf(state, side, country) + event.added);
    }
    expect(interventions.some(({ event }) => event.result > 0)).toBe(true);
    expect(interventions.some(({ event }) => event.result <= 0)).toBe(true);
  });

  it("intervening uses all of a play's points: the side is not asked to place or realign after it", () => {
    const { interventions } = mapGames();
    expect(interventions.length).toBeGreaterThan(0);
    for (const { after, side } of interventions) {
      const asked = after.public.pending.filter((d) => d.side === side).map((d) => d.kind);
      expect(asked).not.toContain("placeInfluence");
      expect(asked).not.toContain("realign");
    }
  });

  it("event points go to interventions too: both sides intervene with a 1-point line, and every game ends", () => {
    const { finals, interventions } = pointsGames();
    expect(finals).toHaveLength(POINTS_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    for (const side of ["lio", "sae"] as const) {
      expect(interventions.some((i) => i.side === side && i.event.points === 1)).toBe(true);
    }
  });
});
