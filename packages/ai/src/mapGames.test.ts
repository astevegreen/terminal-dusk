// Easy in games with a map, influence and the Escalation track (A11a, issue #359).
import { DECKS, reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";
import type { GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { guessHidden } from "./guess.ts";
import { seededRandom } from "./random.ts";
import { escalationRuleset, newMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 50;

type Played = {
  /** Every game's last state. */
  finals: TestState[];
  /** Every state reached, each game's starting state included. */
  states: TestState[];
  /** The Escalation moves made by a card's own escalate step: no crisis in that apply and the same turn after. */
  cardMoves: { from: number; to: number }[];
  /** Every escalationCrisis event. */
  crises: GameEvent[];
  /** The states right after an apply with a crisis. */
  afterCrisis: TestState[];
};

/** Plays one map game with Easy on both sides (playEasy checks every answer), recording what the tests need. */
function playMapGame(seed: number, into: Played): void {
  const start = newMapGame(seed);
  into.states.push(start);
  const final = playEasy(escalationRuleset, start, EASY_WEIGHTS, seededRandom(seed), {
    name: `map game ${seed}`,
    applied: (before, after, events) => {
      into.states.push(after);
      const crises = events.filter((e) => e.kind === "escalationCrisis");
      into.crises.push(...crises);
      if (crises.length > 0) into.afterCrisis.push(after);
      const sameTurn = after.public.turn === before.public.turn && after.public.status.kind === "active";
      if (crises.length > 0 || !sameTurn) return;
      for (const e of events) if (e.kind === "escalationChanged") into.cardMoves.push({ from: e.from, to: e.to });
    },
  });
  into.finals.push(final);
}

let cached: Played | null = null;
/** The 50 seeded games, played once and shared by the tests below. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], states: [], cardMoves: [], crises: [], afterCrisis: [] };
  for (let seed = 1; seed <= GAMES; seed++) playMapGame(seed, into);
  cached = into;
  return into;
}

const sorted = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);

describe("Easy in map games with influence and Escalation", () => {
  it("the map games start with the test map, influence and Escalation 2", () => {
    const start = newMapGame(1);
    expect(start.public.status.kind).toBe("active");
    expect(start.public.map).toBeDefined();
    expect(start.public.influence).toBeDefined();
    expect(start.public.escalation).toBe(2);
  });

  it("plays 50 seeded map games on both sides with only legal answers, and every game ends", () => {
    const { finals } = played();
    expect(finals).toHaveLength(GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
  });

  it("a card's escalate step is seen raising and lowering Escalation, outside a crisis and a turn end", () => {
    const { cardMoves } = played();
    expect(cardMoves.some((m) => m.to > m.from)).toBe(true);
    expect(cardMoves.some((m) => m.to < m.from)).toBe(true);
  });

  it("an escalationCrisis event is seen", () => {
    expect(played().crises.length).toBeGreaterThan(0);
  });

  it("rebuilds every state, starting states included, with the real map, influence and Escalation", () => {
    const { states } = played();
    for (const [i, state] of states.entries()) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const rebuilt = reconstruct(view, guessHidden(escalationRuleset, view, side, seededRandom(i + 1)));
        expect(rebuilt.public.map).toEqual(state.public.map);
        expect(rebuilt.public.influence).toEqual(state.public.influence);
        expect(rebuilt.public.escalation).toEqual(state.public.escalation);
      }
    }
  });

  it("after a crisis, the guessed Contingency decks hold exactly the numbers each view lists as left", () => {
    const { afterCrisis } = played();
    expect(afterCrisis.length).toBeGreaterThan(0);
    for (const [i, state] of afterCrisis.entries()) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const guessed = guessHidden(escalationRuleset, view, side, seededRandom(i + 1));
        for (const deck of DECKS) {
          expect(sorted(guessed.secret.contingency[deck])).toEqual(sorted(view.public.contingency[deck].left));
          expect(sorted(guessed.secret.contingency[deck])).toEqual(sorted(state.secret.contingency[deck]));
        }
      }
    }
  });
});
