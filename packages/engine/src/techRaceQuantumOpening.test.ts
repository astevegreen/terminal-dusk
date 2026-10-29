// R26c (#470): Quantum Computing's opening-card power (docs/design/tech-race.md, "The opening-card power"). At the
// start of a turn, the rival of the side holding Quantum Computing picks its opening card first; the Quantum Computing
// side sees it, then picks its own. Which opening card resolves first is unchanged: more ops first, LIO's on a tie.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { legalAnswers } from "./decisions.ts";
import type { Answer, AnswerValue, CardId, GameState, Side } from "./index.ts";
import { applied, playAnswer } from "./test/game.ts";
import { raceGame, raceRules } from "./test/techRace.ts";

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue): Answer {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

/** The start of turn 2, the marker at `marker` all through turn 1 (LIO plays l3, SAE s2, an extra play passed). */
function nextTurn(marker: number): GameState {
  const start = raceGame({ marker });
  const lio = applied(start, playAnswer(start, "lio", "l3", "event"), raceRules).state;
  let state = applied(lio, playAnswer(lio, "sae", "s2", "event"), raceRules).state;
  if (state.public.pending[0]?.kind === "extraPlay")
    state = applied(state, answer(state, { kind: "pass" }), raceRules).state;
  return state;
}

const ops = (card: CardId): number => raceRules.cards.find((c) => c.id === card)?.ops ?? 0;
const pick = (state: GameState, card: CardId) => applied(state, answer(state, { kind: "chooseCard", card }), raceRules);

describe("Quantum Computing: the rival picks its opening card first", () => {
  it("the turn opens with one pick, the rival's alone, not a simultaneous one", () => {
    const state = nextTurn(-4);
    expect(state.public.turn).toBe(2);
    expect(state.public.pending).toHaveLength(1);
    expect(state.public.pending[0]).toMatchObject({ kind: "chooseCard", side: "sae" });
    expect(state.public.pending[0]).not.toHaveProperty("simultaneousGroup");
    expect(legalAnswers(raceRules, state, "lio")).toEqual([]);
  });

  it("the rival's card leaves its hand face up for the holder to see, then the holder picks", () => {
    const state = nextTurn(-4);
    const card = state.private.sae.hand[0]!;
    const after = pick(state, card).state;
    expect(after.private.sae.hand).not.toContain(card);
    expect(after.public.inPlay).toEqual([card]);
    expect(after.public.inPlayBy).toEqual(["sae"]);
    expect(after.public.pending).toMatchObject([{ kind: "chooseCard", side: "lio" }]);
    expect(after.public.pending[0]).not.toHaveProperty("simultaneousGroup");
    expect(legalAnswers(raceRules, after, "lio")).toEqual(
      after.private.lio.hand.map((c): AnswerValue => ({ kind: "chooseCard", card: c })),
    );
    expect(legalAnswers(raceRules, after, "sae")).toEqual([]);
  });

  it("works for SAE too: LIO picks first", () => {
    const state = nextTurn(4);
    expect(state.public.pending).toMatchObject([{ kind: "chooseCard", side: "lio" }]);
    const card = state.private.lio.hand[0]!;
    const after = pick(state, card).state;
    expect(after.public.inPlay).toEqual([card]);
    expect(after.public.inPlayBy).toEqual(["lio"]);
    expect(after.public.pending).toMatchObject([{ kind: "chooseCard", side: "sae" }]);
  });

  it("the resolution order is unchanged: both cards' events run, more ops first, LIO's card on a tie", () => {
    const state = nextTurn(-4);
    for (const saeCard of state.private.sae.hand) {
      const first = pick(state, saeCard).state;
      // s9 leaves the game after its event instead of going to the discard pile, so the order is read from the others.
      for (const lioCard of first.private.lio.hand.filter((c) => c !== "s9")) {
        const { state: both } = pick(first, lioCard);
        expect(both.private.lio.hand).not.toContain(lioCard);
        // Both events ran (the test cards have none that wait), so both cards are put away and LIO's play is next.
        expect(both.public.inPlay).toEqual([]);
        const saeFirst = ops(saeCard) > ops(lioCard);
        const tail = both.public.discard.slice(-2);
        expect(tail).toEqual(saeFirst ? [saeCard, lioCard] : [lioCard, saeCard]);
        expect(both.public.pending).toMatchObject([{ kind: "playCardAs", side: "lio" }]);
      }
    }
  });

  it("without a holder the opening pick is simultaneous, as before", () => {
    for (const marker of [-3, 0, 3]) {
      const state = nextTurn(marker);
      expect(state.public.pending).toHaveLength(2);
      expect(state.public.pending.every((d) => d.kind === "chooseCard" && d.simultaneousGroup !== undefined)).toBe(
        true,
      );
    }
  });
});

describe("a timeout during Quantum Computing's opening", () => {
  const timeout = (state: GameState, side: Side | "both") => apply(raceRules, state, { system: "timeout", side });
  const outcome = (r: ReturnType<typeof timeout>) => (r.ok ? r.value.state.public.status : r.error.code);

  it("while the rival picks: a loss on time for the rival; refused for the holder or for both", () => {
    const state = nextTurn(-4);
    expect(outcome(timeout(state, "sae"))).toEqual({ kind: "over", winner: "lio", reason: "timeout" });
    expect(outcome(timeout(state, "lio"))).toBe("wrongSide");
    expect(outcome(timeout(state, "both"))).toBe("wrongSide");
  });

  it("while the holder picks: a loss on time for the holder; refused for the rival or for both", () => {
    const state = nextTurn(-4);
    const after = pick(state, state.private.sae.hand[0]!).state;
    expect(outcome(timeout(after, "lio"))).toEqual({ kind: "over", winner: "sae", reason: "timeout" });
    expect(outcome(timeout(after, "sae"))).toBe("wrongSide");
    expect(outcome(timeout(after, "both"))).toBe("wrongSide");
  });
});
