// R26 (#470): the tech race's step powers that change a roll (docs/design/tech-race.md, "What each step gives").
// Powers add up: the side the marker favours holds its step and every step below it; the other side holds none.
// Networks and Orbit (lead 1) adds 1 to the holder's total in each realignment it starts; AI (lead 2) adds 1 to the
// result of each of the holder's interventions.
import { describe, expect, it } from "vitest";
import type { AnswerValue, CountryId, GameEvent, GameState, Side } from "./index.ts";
import { techHolds } from "./techRace.ts";
import { applied, startWith } from "./test/game.ts";
import { mapGame, spend } from "./test/mapGame.ts";
import { choose, nextDraw, raceGame, raceRules } from "./test/techRace.ts";

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue) {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

/** A tech race game at LIO's first play with the marker at `marker` and the influence of mapGame(`counts`). */
function game(marker: number, counts: Record<CountryId, { lio?: number; sae?: number }>): GameState {
  const state = raceGame({ marker });
  return { ...state, public: { ...state.public, influence: mapGame(counts).public.influence! } };
}

// Delta, stability 2: LIO 1, SAE 2. LIO controls charlie and SAE echo, so LIO's map bonus there is 1 and SAE's 3.
const DELTA = { delta: { lio: 1, sae: 2 }, charlie: { lio: 3 }, echo: { sae: 1 } };

/** `side` realigns once in delta, drawing `draws.lio` and `draws.sae`. Its realigned event. */
function realignDelta(marker: number, side: Side, draws: { lio: number; sae: number }): GameEvent | undefined {
  const start = nextDraw(nextDraw(game(marker, DELTA), "lio", draws.lio), "sae", draws.sae);
  const menu = startWith([spend(side, 1)], raceRules, start).state;
  const asked = applied(menu, choose(menu, { kind: "chooseAction", action: "realign" }), raceRules).state;
  const { events } = applied(asked, answer(asked, { kind: "realign", country: "delta" }), raceRules);
  return events.find((e) => e.kind === "realigned");
}

/** `side` intervenes with 2 points, drawing `draw`: LIO in echo, SAE in bravo, both stability 1. Its intervened event. */
function interveneEcho(marker: number, side: Side, draw: number): GameEvent | undefined {
  const start = nextDraw(game(marker, { echo: { sae: 3 }, bravo: { lio: 3 } }), side, draw);
  const country = side === "lio" ? "echo" : "bravo";
  const menu = startWith([spend(side, 2)], raceRules, start).state;
  const { events } = applied(menu, choose(menu, { kind: "chooseAction", action: "intervene", country }), raceRules);
  return events.find((e) => e.kind === "intervened");
}

describe("holding a step", () => {
  it("the side the marker favours holds its step and every step below it; the other side holds none", () => {
    const pub = raceGame({ marker: -3 }).public;
    expect([1, 2, 3, 4].map((step) => techHolds(pub, "lio", step))).toEqual([true, true, true, false]);
    expect([1, 2, 3, 4].map((step) => techHolds(pub, "sae", step))).toEqual([false, false, false, false]);
  });

  it("at parity nobody holds anything", () => {
    const pub = raceGame({ marker: 0 }).public;
    expect(techHolds(pub, "lio", 1) || techHolds(pub, "sae", 1)).toBe(false);
  });

  it("a game without a tech race holds nothing", () => {
    expect(techHolds(mapGame().public, "sae", 1)).toBe(false);
  });
});

describe("Networks and Orbit: +1 in each realignment the holder starts", () => {
  it("adds 1 to the holder's total, at its own step and every lead above it", () => {
    for (const marker of [-1, -2, -3, -4]) {
      expect(realignDelta(marker, "lio", { lio: 3, sae: 3 })).toMatchObject({ totals: { lio: 5, sae: 6 }, tech: 1 });
    }
  });

  it("adds nothing at parity, and the event then has no tech field", () => {
    const event = realignDelta(0, "lio", { lio: 3, sae: 3 });
    expect(event).toMatchObject({ totals: { lio: 4, sae: 6 } });
    expect(event).not.toHaveProperty("tech");
  });

  it("adds nothing to a realignment the rival starts, even to the holder's own total", () => {
    expect(realignDelta(-2, "sae", { lio: 3, sae: 3 })).toMatchObject({ totals: { lio: 4, sae: 6 } });
  });

  it("works for SAE too", () => {
    expect(realignDelta(1, "sae", { lio: 3, sae: 3 })).toMatchObject({ totals: { lio: 4, sae: 7 }, tech: 1 });
  });
});

describe("AI: +1 to the result of each of the holder's interventions", () => {
  it("adds 1 to the result from lead 2 upwards", () => {
    // draw 3 + 2 points - 2 x stability 1 = 3, plus 1.
    for (const marker of [-2, -3, -4]) {
      expect(interveneEcho(marker, "lio", 3)).toMatchObject({ result: 4, removed: 3, added: 1, tech: 1 });
    }
  });

  it("adds nothing at lead 1 or to the side behind", () => {
    expect(interveneEcho(-1, "lio", 3)).toMatchObject({ result: 3 });
    expect(interveneEcho(-1, "lio", 3)).not.toHaveProperty("tech");
    expect(interveneEcho(-2, "sae", 3)).toMatchObject({ result: 3 });
  });

  it("works for SAE too", () => {
    expect(interveneEcho(2, "sae", 3)).toMatchObject({ result: 4, tech: 1 });
  });
});
