// #628: Medium (and so Hard) plays for Unified command on purpose: a play of the side's own card for its event is
// worth the bonus it sets up for the side's next play for points this turn (docs/design/sides.md, "SAE: Unified
// command"), while that next play is still to come.
import { legalAnswers, SIDES, viewFor } from "@terminal-dusk/engine";
import type { AbilityState, AnswerValue, PlayerView, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { primeBonus } from "./command.ts";
import { easyAnswer } from "./easy.ts";
import { scoredAnswers } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { applyAnswer, newGame, ruleset } from "./test/testGames.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

type Play = Extract<AnswerValue, { kind: "playCardAs" }>;

/** A game Easy has played up to the first play of a card, and the side whose play it is. */
function atPlay(seed: number): { state: TestState; side: Side } {
  let state = newGame(seed);
  for (let step = 0; step < 20; step++) {
    const side = SIDES.find((s) => legalAnswers(ruleset, state, s).some((a) => a.kind === "playCardAs"));
    if (side !== undefined) return { state, side };
    const d = state.public.pending[0]!;
    const value = easyAnswer(ruleset, viewFor(state, d.side), d.side, EASY_WEIGHTS, seededRandom(seed))!;
    state = applyAnswer(state, { decisionId: d.id, side: d.side, value });
  }
  throw new Error(`seed ${seed}: no play of a card within 20 answers`);
}

type Command = { ready?: boolean; used?: number; playsMade?: number; abilities?: boolean; hand?: number };

/**
 * `view` with two plays per turn, `side`'s first play of the turn (or `playsMade`), and `side`'s Unified command
 * (bonus 2, neither ready nor used unless said) against the other side's Resilient institutions.
 */
function withCommand(view: PlayerView, side: Side, c: Command = {}): PlayerView {
  const command: AbilityState = { id: "unifiedCommand", bonus: 2, ready: c.ready ?? false, used: c.used ?? 0 };
  const other: AbilityState = { id: "resilientInstitutions", perTurn: 1, used: 0 };
  const abilities = side === "lio" ? { lio: command, sae: other } : { lio: other, sae: command };
  const playsMade = c.playsMade ?? (side === "lio" ? 0 : 1);
  const pub = { ...view.public, playsPerTurn: 2, playsMade, ...(c.abilities === false ? {} : { abilities }) };
  if (c.abilities === false) delete (pub as { abilities?: unknown }).abilities;
  const mine = view.mine == null ? view.mine : { ...view.mine, hand: view.mine.hand.slice(0, c.hand) };
  return { ...view, public: pub, mine } as PlayerView;
}

const cardOf = (id: string) => ruleset.cards.find((c) => c.id === id)!;
const plays = (answers: readonly AnswerValue[]) => answers.filter((a): a is Play => a.kind === "playCardAs");
const ownEvent = (a: AnswerValue, side: Side) =>
  a.kind === "playCardAs" && a.as === "event" && cardOf(a.card).affiliation === side;

/** The first seeds' plays, each with its view and side, that hold an own card's event. */
function cases(): { state: TestState; side: Side; view: PlayerView; answers: Play[] }[] {
  const found = [];
  for (let seed = 1; seed <= 10; seed++) {
    const { state, side } = atPlay(seed);
    const answers = plays(legalAnswers(ruleset, state, side));
    if (answers.some((a) => ownEvent(a, side))) found.push({ state, side, view: viewFor(state, side), answers });
  }
  expect(found.length).toBeGreaterThan(0);
  return found;
}

describe("primeBonus: what an own card's event sets up for Unified command", () => {
  it("is the bonus for an own card's event with a play left, and 0 for a neutral card, a rival's card or a points play", () => {
    for (const { side, view, answers } of cases()) {
      const v = withCommand(view, side);
      for (const a of answers) expect(primeBonus(ruleset, v, side, a)).toBe(ownEvent(a, side) ? 2 : 0);
    }
  });

  it("is 0 on the side's last play of the turn (LIO at playsMade 2, SAE at 3)", () => {
    for (const { side, view, answers } of cases()) {
      const v = withCommand(view, side, { playsMade: side === "lio" ? 2 : 3 });
      for (const a of answers) expect(primeBonus(ruleset, v, side, a)).toBe(0);
    }
  });

  it("is 0 while the command is ready already or was used this turn", () => {
    for (const { side, view, answers } of cases()) {
      for (const c of [{ ready: true }, { used: 1 }]) {
        const v = withCommand(view, side, c);
        for (const a of answers) expect(primeBonus(ruleset, v, side, a)).toBe(0);
      }
    }
  });

  it("is 0 in a game without abilities, with a one-card hand, and for an opening pick", () => {
    for (const { side, view, answers } of cases()) {
      const none = withCommand(view, side, { abilities: false });
      const oneCard = withCommand(view, side, { hand: 1 });
      for (const a of answers) {
        expect(primeBonus(ruleset, none, side, a)).toBe(0);
        expect(primeBonus(ruleset, oneCard, side, a)).toBe(0);
        expect(primeBonus(ruleset, withCommand(view, side), side, { kind: "chooseCard", card: a.card })).toBe(0);
      }
    }
  });
});

describe("Medium and Unified command", () => {
  it("scores an own card's event the ops weight times the bonus higher while it sets the command up, and nothing else", () => {
    for (const { side, view } of cases()) {
      const setUp = scoredAnswers(ruleset, withCommand(view, side), side, MEDIUM_WEIGHTS, seededRandom(9))!;
      const used = scoredAnswers(ruleset, withCommand(view, side, { used: 1 }), side, MEDIUM_WEIGHTS, seededRandom(9))!;
      expect(setUp).toHaveLength(used.length);
      setUp.forEach(({ answer, score }, i) => {
        expect(score - used[i]!.score).toBeCloseTo(ownEvent(answer, side) ? MEDIUM_WEIGHTS.ops * 2 : 0);
      });
    }
  });

  it("leaves Easy's answer as it was", () => {
    for (const { side, view } of cases()) {
      const setUp = easyAnswer(ruleset, withCommand(view, side), side, EASY_WEIGHTS, seededRandom(4));
      const used = easyAnswer(ruleset, withCommand(view, side, { used: 1 }), side, EASY_WEIGHTS, seededRandom(4));
      expect(setUp).toEqual(used);
    }
  });
});
