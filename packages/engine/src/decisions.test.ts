import { describe, expect, it } from "vitest";
import { legalAnswers, pendingFor, SIDES } from "./index.ts";
import { choose, playAnswers, ruleset, startAtPass, startGame, startWith } from "./test/game.ts";

describe("pendingFor", () => {
  it("returns the decision that side must answer, or null", () => {
    const s = startAtPass();
    expect(pendingFor(s, "lio")).toMatchObject({ side: "lio", kind: "pass" });
    expect(pendingFor(s, "sae")).toBeNull();
  });
  it("returns null for both sides once the game is over", () => {
    const over = playAnswers(startGame(1), 4);
    expect(pendingFor(over, "lio")).toBeNull();
    expect(pendingFor(over, "sae")).toBeNull();
  });
});

describe("legalAnswers", () => {
  it("lists the finite legal answers for that side's pending decision: one pass", () => {
    expect(legalAnswers(ruleset, startAtPass(), "lio")).toEqual([{ kind: "pass" }]);
  });
  it("lists yes then no for a yesNo decision", () => {
    const paused = startWith([choose("go", "sae")]).state;
    expect(legalAnswers(ruleset, paused, "sae")).toEqual([
      { kind: "yesNo", yes: true },
      { kind: "yesNo", yes: false },
    ]);
    expect(legalAnswers(ruleset, paused, "lio")).toEqual([]);
  });
  it("returns [] for a side with no pending decision", () => {
    expect(legalAnswers(ruleset, startAtPass(), "sae")).toEqual([]);
  });
  it("returns [] once the game is over", () => {
    const over = playAnswers(startGame(1), 4);
    expect(legalAnswers(ruleset, over, "lio")).toEqual([]);
    expect(legalAnswers(ruleset, over, "sae")).toEqual([]);
  });
  it("rulesetMismatch: returns [] for a ruleset whose id is not state.meta.ruleset", () => {
    expect(legalAnswers({ ...ruleset, id: "another-ruleset" }, startGame(), "lio")).toEqual([]);
  });
});

describe("public.pending", () => {
  it("holds the open decisions; a new game has the opening yes/no pair, one decision per side", () => {
    const s = startGame();
    const group = expect.any(String);
    expect(s.public.pending).toEqual([
      { id: expect.any(String), side: "lio", kind: "yesNo", options: {}, simultaneousGroup: group },
      { id: expect.any(String), side: "sae", kind: "yesNo", options: {}, simultaneousGroup: group },
    ]);
  });
  it("is kept in SIDES order", () => {
    let s = startGame(3);
    while (s.public.pending.length > 0) {
      const sides = s.public.pending.map((x) => x.side);
      expect(sides).toEqual(SIDES.filter((side) => sides.includes(side)));
      s = playAnswers(s, 1);
    }
  });
  it("decision IDs are unique within a game", () => {
    let s = startGame(3);
    const ids: string[] = [];
    while (s.public.pending.length > 0) {
      // Each decision is answered exactly once, so list each one's ID as it is answered.
      ids.push(s.public.pending[0]!.id);
      s = playAnswers(s, 1);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(12);
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
    expect(playAnswers(startGame(1), 4).public.status).toEqual({
      kind: "over",
      winner: null,
      reason: "placeholderFinished",
    });
  });
});
