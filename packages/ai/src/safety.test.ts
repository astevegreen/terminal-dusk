import { viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, PlayerView } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { crisisShare, expectedCrisisCost, safetyScore } from "./safety.ts";
import { escalationRuleset, newMapGame } from "./test/mapGames.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

// escalationRuleset: card x(i+1) is LIO's when i % 3 = 0, SAE's when 1, neutral when 2; by i % 6 it raises Escalation
// by 1 (x1, LIO's), by 2 (x2, SAE's), lowers it by 1 (x3, neutral) or does nothing (x5 SAE's, x6 neutral).
const card = (id: string) => escalationRuleset.cards.find((c) => c.id === id)!;
const pick = (id: string): AnswerValue => ({ kind: "chooseCard", card: id });
const play = (id: string, as: "event" | "points"): AnswerValue => ({ kind: "playCardAs", card: id, as }) as AnswerValue;

/** LIO's view of a map game with Escalation at `level` and `hand` as its hand. */
function viewAt(level: number | undefined, hand: string[] = []): PlayerView {
  const view = viewFor(newMapGame(2), "lio");
  return {
    ...view,
    public: { ...view.public, escalation: level },
    mine: view.mine === undefined ? view.mine : { ...view.mine, hand },
  } as PlayerView;
}

/** `view` with the numbers left in LIO's Contingency deck replaced. */
function withDeck(view: PlayerView, left: number[]): PlayerView {
  const contingency = { ...view.public.contingency, lio: { ...view.public.contingency.lio, left } };
  return { ...view, public: { ...view.public, contingency } };
}

const score = (view: PlayerView, id: string, answer: AnswerValue) =>
  safetyScore(escalationRuleset, view, "lio", card(id), answer, MEDIUM_WEIGHTS);

describe("expectedCrisisCost", () => {
  it("is the mean of the numbers left in the side's Contingency deck", () => {
    expect(expectedCrisisCost(withDeck(viewAt(2), [2, 4]), "lio")).toBe(3);
  });

  it("is 3.5 when the deck has nothing left", () => {
    expect(expectedCrisisCost(withDeck(viewAt(2), []), "lio")).toBe(3.5);
  });
});

describe("crisisShare", () => {
  it("is 0 when no unseen card can reach 6 from the level", () => {
    expect(crisisShare(escalationRuleset, viewAt(0), "lio", 0)).toBe(0);
  });

  it("is 0 below the level where a card could reach 6, and a share of 0 to 1 at it", () => {
    const view = viewAt(3);
    const low = crisisShare(escalationRuleset, view, "lio", 3);
    const high = crisisShare(escalationRuleset, view, "lio", 4);
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(1);
  });
});

describe("safetyScore", () => {
  const crisis = -MEDIUM_WEIGHTS.crisis;

  it("charges a crisis for an opening pick that raises Escalation to 6", () => {
    const view = viewAt(5);
    expect(score(view, "x1", pick("x1"))).toBeCloseTo(crisis * expectedCrisisCost(view, "lio"));
  });

  it("charges a crisis for a played event and for a rival's card played for points, but not for own points", () => {
    const view = viewAt(4);
    const cost = crisis * expectedCrisisCost(view, "lio");
    expect(score(view, "x2", play("x2", "event"))).toBeCloseTo(cost);
    expect(score(view, "x2", play("x2", "points"))).toBeCloseTo(cost);
    expect(score(view, "x1", play("x1", "points"))).toBe(0);
  });

  it("does not charge a card that lowers Escalation or leaves it alone", () => {
    const view = viewAt(5);
    expect(score(view, "x3", pick("x3"))).toBe(0);
    expect(score(view, "x6", pick("x6"))).toBe(0);
  });

  it("is 0 on a game with no Escalation", () => {
    expect(score(viewAt(undefined), "x1", pick("x1"))).toBe(0);
  });

  it("rewards leaving Escalation where a rival's unseen card could cause a crisis for the rival", () => {
    const bonus = score(viewAt(3), "x1", pick("x1"));
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(MEDIUM_WEIGHTS.trap);
  });

  it("gives that reward up when one of its own other cards would then cause a crisis", () => {
    expect(score(viewAt(3, ["x2"]), "x1", pick("x1"))).toBe(0);
  });
});
