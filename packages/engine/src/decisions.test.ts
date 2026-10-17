import { describe, expect, it } from "vitest";
import { legalAnswers, pendingFor, SIDES } from "./index.ts";
import { playPasses, ruleset, startGame } from "./test/game.ts";

describe("pendingFor", () => {
  it("returns the decision that side must answer, or null", () => {
    const s = startGame();
    expect(pendingFor(s, "lio")).toMatchObject({ side: "lio", kind: "pass" });
    expect(pendingFor(s, "sae")).toBeNull();
  });
  it("returns null for both sides once the game is over", () => {
    const over = playPasses(startGame(1), 2);
    expect(pendingFor(over, "lio")).toBeNull();
    expect(pendingFor(over, "sae")).toBeNull();
  });
});

describe("legalAnswers", () => {
  it("lists the finite legal answers for that side's pending decision: one pass", () => {
    expect(legalAnswers(ruleset, startGame(), "lio")).toEqual([{ kind: "pass" }]);
  });
  it("returns [] for a side with no pending decision", () => {
    expect(legalAnswers(ruleset, startGame(), "sae")).toEqual([]);
  });
  it("returns [] once the game is over", () => {
    const over = playPasses(startGame(1), 2);
    expect(legalAnswers(ruleset, over, "lio")).toEqual([]);
    expect(legalAnswers(ruleset, over, "sae")).toEqual([]);
  });
  it("rulesetMismatch: returns [] for a ruleset whose id is not state.meta.ruleset", () => {
    expect(legalAnswers({ id: "another-ruleset" }, startGame(), "lio")).toEqual([]);
  });
});

describe("public.pending", () => {
  it("holds the open decisions; a new game has LIO's pass decision only", () => {
    const s = startGame();
    expect(s.public.pending).toEqual([{ id: expect.any(String), side: "lio", kind: "pass", options: {} }]);
  });
  it("is kept in SIDES order", () => {
    let s = startGame(3);
    while (s.public.pending.length > 0) {
      const sides = s.public.pending.map((x) => x.side);
      expect(sides).toEqual(SIDES.filter((side) => sides.includes(side)));
      s = playPasses(s, 1);
    }
  });
  it("decision IDs are unique within a game", () => {
    let s = startGame(3);
    const ids: string[] = [];
    while (s.public.pending.length > 0) {
      ids.push(...s.public.pending.map((x) => x.id));
      s = playPasses(s, 1);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(6);
  });
  it("a decision's options never list cards from a hand or the deck", () => {
    const s = startGame();
    const shown = JSON.stringify(s.public.pending);
    for (const card of [...s.private.lio.hand, ...s.private.sae.hand, ...s.secret.deck]) {
      expect(shown).not.toContain(card);
    }
  });
});

describe("public.status", () => {
  it("is { kind: 'active' } while the game runs", () => {
    expect(startGame().public.status).toEqual({ kind: "active" });
  });
  it("is { kind: 'over', winner, reason } once the game ends", () => {
    expect(playPasses(startGame(1), 2).public.status).toEqual({
      kind: "over",
      winner: null,
      reason: "placeholderFinished",
    });
  });
});
