// Easy answers the action menu's realign (A11d, issue #372): the menu, then one realign decision per attempt, each
// a country or a stop (R16c). Easy answers both through legalAnswers; these tests play whole map games through them.
import { legalAnswers, viewFor } from "@terminal-dusk/engine";
import type { Answer, AnswerValue, CountryId, Realigned, RealignOptions, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { seededRandom } from "./random.ts";
import { escalationRuleset, newMapGame, newPointsMapGame, pointsRuleset } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const MAP_GAMES = 50;
const POINTS_GAMES = 20;
/** The random seeds Easy is asked again with at a realign decision. */
const RETRIES = 5;

const rivalOf = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** `side`'s influence in `country` in `state`. */
const influenceOf = (state: TestState, side: Side, country: CountryId): number =>
  state.public.influence?.find((e) => e.country === country)?.[side] ?? 0;

/** A realign decision `side` was asked: the state it was asked in and the decision's options. */
type Asked = { state: TestState; side: Side; options: RealignOptions };

/** One attempt made: the decision, the country picked, the state after and its realigned event. */
type Attempt = Asked & { country: CountryId; after: TestState; event: Realigned };

/** One play's points spent on realigning: the menu's points and each realign answer's country (null: stop). */
type Play = { side: Side; points: number; asked: number[]; picks: (CountryId | null)[] };

type Played = { finals: TestState[]; asked: Asked[]; attempts: Attempt[]; plays: Play[] };

/** The realign decision pending for `side` in `state`, or null. */
function realignFor(state: TestState, side: Side): Asked | null {
  const decision = state.public.pending.find((d) => d.side === side && d.kind === "realign");
  if (decision === undefined || !("attempts" in decision.options)) return null;
  return { state, side, options: decision.options as RealignOptions };
}

const valueOf = (answer: Answer): AnswerValue | null => ("value" in answer ? answer.value : null);

/** Plays games from `start(seed)` for seeds 1 to `games` with Easy on both sides (playEasy checks every answer). */
function playAll(rules: typeof pointsRuleset, start: (seed: number) => TestState, games: number): Played {
  const into: Played = { finals: [], asked: [], attempts: [], plays: [] };
  for (let seed = 1; seed <= games; seed++) {
    const open: Partial<Record<Side, Play>> = {};
    const final = playEasy(rules, start(seed), EASY_WEIGHTS, seededRandom(seed), {
      name: `${rules.id} game ${seed}`,
      applied: (before, after, events, answer) => {
        const value = valueOf(answer);
        if (value === null || answer.side === "both") return;
        const side = answer.side;
        if (value.kind === "chooseAction" && value.action === "realign") {
          const menu = before.public.pending.find((d) => d.side === side && d.kind === "chooseAction");
          const points = menu !== undefined && "points" in menu.options ? menu.options.points : 0;
          open[side] = { side, points, asked: [], picks: [] };
        }
        if (value.kind === "realign") {
          const asked = realignFor(before, side);
          const play = open[side];
          if (asked === null || play === undefined) throw new Error(`game ${seed}: a realign answer outside a play`);
          into.asked.push(asked);
          play.asked.push(asked.options.attempts);
          play.picks.push(value.country);
          if (value.country !== null) {
            const made = events.filter((e): e is Realigned => e.kind === "realigned");
            if (made.length !== 1) throw new Error(`game ${seed}: an attempt made ${made.length} realigned events`);
            into.attempts.push({ ...asked, country: value.country, after, event: made[0]! });
          }
        }
        // A play ends when a realign answer (or the menu's pick) leaves no attempt asked for.
        const realigning = value.kind === "realign" || (value.kind === "chooseAction" && value.action === "realign");
        const play = open[side];
        if (realigning && play !== undefined && realignFor(after, side) === null) {
          into.plays.push(play);
          delete open[side];
        }
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

describe("Easy answers the action menu's realign (A11d)", () => {
  it("Easy realigns in the map games: each attempt is one realignment in that country, and every game ends", () => {
    const { finals, attempts } = mapGames();
    expect(finals).toHaveLength(MAP_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    expect(attempts.length).toBeGreaterThan(0);
    for (const { side, options, country, event } of attempts) {
      expect(options.targets).toContain(country);
      expect(event).toMatchObject({ side, country });
    }
  });

  it("Easy names only a country where the rival has influence, or stops", () => {
    const { asked } = mapGames();
    expect(asked.length).toBeGreaterThan(0);
    for (const { state, side } of asked) {
      for (let seed = 1; seed <= RETRIES; seed++) {
        const value = easyAnswer(escalationRuleset, viewFor(state, side), side, EASY_WEIGHTS, seededRandom(seed));
        expect(value?.kind).toBe("realign");
        expect(legalAnswers(escalationRuleset, state, side)).toContainEqual(value);
        if (value?.kind !== "realign" || value.country === null) continue;
        expect(influenceOf(state, rivalOf(side), value.country)).toBeGreaterThan(0);
      }
    }
  });

  it("one attempt per point: each is asked with one fewer left, and Easy both stops early and uses every attempt", () => {
    const { plays } = mapGames();
    expect(plays.length).toBeGreaterThan(0);
    for (const { points, asked, picks } of plays) {
      expect(asked[0]).toBe(points);
      expect(asked).toEqual(asked.map((_, i) => points - i));
      // Only the last answer may stop.
      expect(picks.slice(0, -1)).not.toContain(null);
    }
    expect(plays.some(({ picks }) => picks.at(-1) === null)).toBe(true);
    expect(plays.some(({ points, picks }) => picks.length === points && picks.at(-1) !== null)).toBe(true);
  });

  it("an attempt takes the difference from the lower total's influence there, stopping at 0; a tie takes nothing", () => {
    const { attempts } = mapGames();
    for (const { state, after, side, country, event } of attempts) {
      const { lio, sae } = event.totals;
      const loser: Side | null = lio === sae ? null : lio < sae ? "lio" : "sae";
      expect(event.loser).toBe(loser);
      const had = loser === null ? 0 : influenceOf(state, loser, country);
      expect(event.removed).toBe(loser === null ? 0 : Math.min(had, Math.abs(lio - sae)));
      for (const s of [side, rivalOf(side)]) {
        const lost = s === loser ? event.removed : 0;
        expect(influenceOf(after, s, country)).toBe(influenceOf(state, s, country) - lost);
      }
    }
    expect(attempts.some(({ side, event }) => event.loser === rivalOf(side))).toBe(true);
    expect(attempts.some(({ side, event }) => event.loser === side)).toBe(true);
    expect(attempts.some(({ event }) => event.loser === null)).toBe(true);
  });

  it("event points go to realigning too: both sides realign with a 1-point line, and every game ends", () => {
    const { finals, plays } = pointsGames();
    expect(finals).toHaveLength(POINTS_GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
    for (const side of ["lio", "sae"] as const) {
      expect(plays.some((p) => p.side === side && p.points === 1)).toBe(true);
    }
  });
});
