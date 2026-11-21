// The turn structure the owner decided on 21 Nov 2026, in the scenarios that are the real game: 2 plays each per turn
// in the order LIO, SAE, LIO, SAE (docs/design/core-loop.md, "A turn"), a 10-turn base game with Era 2 entering on
// turn 4 and Era 3 on turn 6, and the free player's 3-turn Era 1 game (docs/design/eras.md). Each game is played to
// its end with the first legal answer every time, so the length and play order come from the engine, not the file.
import { apply, createGame, legalAnswers, seedHash } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { ERA_1_CARDS } from "./era1.ts";
import { ERA_1_FREE_SCENARIO } from "./eraOneFreeScenario.ts";
import { FIRST_DECK_RULESET } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { scenarioSetup } from "./scenario.ts";
import { SIX_REGION_MAP_SCENARIO } from "./sixRegionMapScenario.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";

/** More answers than either game needs; past it the game is taken not to end. */
const MOST_ANSWERS = 5000;

/**
 * Plays the scenario from `seed`, started as packages/host/src/firstDeck.ts starts a game, to its end. Returns, per
 * turn, the side of each card play after the opening cards (`plays`), the turn each era started on (`eraTurns`)
 * and the last state (`last`).
 */
function playThrough(scenario: typeof FIRST_DECK_SCENARIO, seed: string) {
  const made = createGame(
    FIRST_DECK_RULESET,
    {
      seedHash: seedHash(seed),
      hands: { lio: [], sae: [] },
      deck: ERA_1_CARDS.map((c) => c.id),
      ...scenarioSetup(scenario),
    },
    seed,
  );
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  let state = made.value.state;
  const plays = new Map<number, Side[]>();
  const eraTurns = new Map<string, number>();
  for (let answers = 0; state.public.status.kind === "active"; answers++) {
    if (answers === MOST_ANSWERS) throw new Error(`the ${scenario.id} game did not end`);
    const decision = state.public.pending[0]!;
    if (decision.kind === "playCardAs") {
      const turn = state.public.turn;
      plays.set(turn, [...(plays.get(turn) ?? []), decision.side]);
    }
    const value = legalAnswers(FIRST_DECK_RULESET, state, decision.side)[0]!;
    const turn = state.public.turn;
    const applied = apply(FIRST_DECK_RULESET, state, { decisionId: decision.id, side: decision.side, value });
    if (!applied.ok) throw new Error(`apply refused: ${applied.error.code}`);
    state = applied.value.state;
    for (const event of applied.value.events) {
      // An era starts as its turn begins, so the turn has moved on by the time the answer that ended the last returns.
      if (event.kind === "eraStarted") eraTurns.set(event.era, Math.max(turn, state.public.turn));
    }
  }
  return { plays, eraTurns, last: state };
}

/** Whether every turn's card plays went LIO, SAE, LIO, SAE (a side with no card left passes, so a turn may be shorter). */
function playsAlternate(plays: Map<number, Side[]>): boolean {
  return [...plays.values()].every((sides) => sides.every((side, i) => side === (i % 2 === 0 ? "lio" : "sae")));
}

describe("the base game (owner, 21 Nov 2026)", () => {
  it("runs 10 turns with 2 plays each per turn and hands of 8, and is not a test scenario", () => {
    expect(FIRST_DECK_SCENARIO).toMatchObject({
      id: "base-game",
      turns: 10,
      playsPerTurn: 2,
      handSize: 8,
      firstEra: "era-1",
    });
    expect(FIRST_DECK_SCENARIO.name).not.toMatch(/TEST|placeholder/i);
  });
  it("brings Era 2 in on turn 4 and Era 3 on turn 6, and no other era", () => {
    expect(FIRST_DECK_SCENARIO.eras?.map((e) => [e.era, e.turn])).toEqual([
      ["era-2", 4],
      ["era-3", 6],
    ]);
  });
  it("keeps the future cards out: they belong to the 2025-2027 scenario, which stops at 2027", () => {
    const listed = new Set((FIRST_DECK_SCENARIO.eras ?? []).flatMap((e) => e.cards));
    for (const card of FUTURE_CARDS) expect(listed.has(card.id)).toBe(false);
  });
  it("plays to the end of turn 10, LIO, SAE, LIO, SAE each turn, with the eras entering on turns 4 and 6", () => {
    for (const seed of ["base-a", "base-b"]) {
      const { plays, eraTurns, last } = playThrough(FIRST_DECK_SCENARIO, seed);
      expect(last.public.status.kind).toBe("over");
      expect(last.public.turn).toBe(10);
      expect([...plays.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(plays.get(1)).toEqual(["lio", "sae", "lio", "sae"]);
      expect(playsAlternate(plays)).toBe(true);
      expect(Object.fromEntries(eraTurns)).toEqual({ "era-2": 4, "era-3": 6 });
    }
  });
});

describe("the six-region map scenario's numbers", () => {
  it("are the base game's: 10 turns, 2 plays each per turn, hands of 8", () => {
    expect(SIX_REGION_MAP_SCENARIO).toMatchObject({ turns: 10, playsPerTurn: 2, handSize: 8 });
    expect(SIX_REGION_MAP_SCENARIO.name).not.toMatch(/placeholder/i);
  });
});

describe("the free player's game against the AI (owner, 21 Nov 2026)", () => {
  it("is Era 1 only: 3 turns, 2 plays each per turn, hands of 8, no later era", () => {
    expect(ERA_1_FREE_SCENARIO).toMatchObject({
      id: "era-1-free",
      turns: 3,
      playsPerTurn: 2,
      handSize: 8,
      firstEra: "era-1",
    });
    expect(ERA_1_FREE_SCENARIO.eras ?? []).toEqual([]);
  });
  it("plays to the end of turn 3, LIO, SAE, LIO, SAE each turn, with Era 1's cards only", () => {
    const { plays, eraTurns, last } = playThrough(ERA_1_FREE_SCENARIO, "free-a");
    expect(last.public.status.kind).toBe("over");
    expect(last.public.turn).toBe(3);
    expect(plays.get(1)).toEqual(["lio", "sae", "lio", "sae"]);
    expect(playsAlternate(plays)).toBe(true);
    expect(eraTurns.size).toBe(0);
    const era1 = new Set(ERA_1_CARDS.map((c) => c.id));
    const seen = [...last.private.lio.hand, ...last.private.sae.hand, ...last.secret.deck, ...last.public.discard];
    for (const id of seen) expect(era1.has(id)).toBe(true);
  });
});
