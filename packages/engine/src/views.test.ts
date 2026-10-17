import { describe, expect, it } from "vitest";
import { hiddenPart, reconstruct, viewFor } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { playAnswers, startGame } from "./test/game.ts";

// startGame: LIO holds c1, c2; SAE holds c3; the deck is c4, c5, c6, shuffled.

describe("viewFor", () => {
  it("a side gets the public compartment, its own private compartment as mine, and counts", () => {
    const s = startGame();
    const view = viewFor(s, "lio");
    expect(view.public).toEqual(s.public);
    expect(view.mine).toEqual({ hand: ["c1", "c2"], picks: [] });
    expect(view.counts).toEqual({ deck: 3, hands: { lio: 2, sae: 1 } });
    expect(view.meta).toEqual(s.meta);
    expect(viewFor(s, "sae").mine).toEqual({ hand: ["c3"], picks: [] });
  });
  it("a spectator gets mine = null and both hand sizes", () => {
    const view = viewFor(startGame(), "spectator");
    expect(view.mine).toBeNull();
    expect(view.counts).toEqual({ deck: 3, hands: { lio: 2, sae: 1 } });
  });
  it("the opponent's hand appears only as a number, never as a list", () => {
    const json = JSON.stringify(viewFor(startGame(), "sae"));
    for (const card of ["c1", "c2"]) expect(json).not.toContain(`"${card}"`);
    expect(viewFor(startGame(), "sae").counts.hands.lio).toBe(2);
  });
  it("a view has exactly the four parts public, mine, counts and meta", () => {
    expect(Object.keys(viewFor(startGame(), "lio")).sort()).toEqual(["counts", "meta", "mine", "public"]);
  });
  it("does not change the state, and the view shares no objects with it", () => {
    const s = deepFreeze(startGame());
    const view = viewFor(s, "lio");
    view.mine?.hand.push("extra");
    view.public.discard.push("extra");
    expect(s.private.lio.hand).toEqual(["c1", "c2"]);
    expect(s.public.discard).toEqual([]);
  });
});

describe("hiddenPart and reconstruct", () => {
  it("hiddenPart holds the opponent's private compartment and the secret compartment", () => {
    const s = startGame();
    const hidden = hiddenPart(s, "lio");
    expect(hidden.viewer).toBe("lio");
    expect(hidden.opponent).toEqual({ hand: ["c3"], picks: [] });
    expect(hidden.secret).toEqual(s.secret);
  });
  it("reconstruct(viewFor(s, x), hiddenPart(s, x)) rebuilds the state exactly, for both sides", () => {
    const s = deepFreeze(playAnswers(startGame(3), 3));
    for (const side of ["lio", "sae"] as const) {
      const rebuilt = reconstruct(viewFor(s, side), hiddenPart(s, side));
      expect(rebuilt).toStrictEqual(s);
      expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(s));
    }
  });
  it("reconstruct uses guessed hidden cards, as the AI will", () => {
    const s = startGame();
    const guess = { ...hiddenPart(s, "lio"), opponent: { hand: ["g1"], picks: [] } };
    const rebuilt = reconstruct(viewFor(s, "lio"), guess);
    expect(rebuilt.private).toEqual({ lio: { hand: ["c1", "c2"], picks: [] }, sae: { hand: ["g1"], picks: [] } });
  });
  it("the rebuilt state shares no objects with the view or the hidden part", () => {
    const s = startGame();
    const view = viewFor(s, "sae");
    const hidden = hiddenPart(s, "sae");
    const rebuilt = reconstruct(view, hidden);
    const deckBefore = [...hidden.secret.deck];
    rebuilt.private.sae.hand.push("x");
    rebuilt.private.lio.hand.push("x");
    rebuilt.secret.deck.push("x");
    expect(view.mine?.hand).toEqual(["c3"]);
    expect(hidden.opponent.hand).toEqual(["c1", "c2"]);
    expect(hidden.secret.deck).toEqual(deckBefore);
    expect(deckBefore).toHaveLength(3);
  });
  it("a spectator view cannot be rebuilt, because it has no own hand", () => {
    const s = startGame();
    expect(() => reconstruct(viewFor(s, "spectator"), hiddenPart(s, "lio"))).toThrow(/spectator/);
  });
});
