import { apply, legalAnswers, pendingFor, viewFor } from "@terminal-dusk/engine";
import type { CardDef, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { escalationRuleset, newMapGame } from "./test/mapGames.ts";
import { escalationEffect, unseenCards } from "./unseen.ts";

const card = (effect: Step[]): CardDef => ({ id: "t", era: "test", ops: 1, affiliation: "neutral", effect });
const up = (by: number): Step => ({ op: "escalate", by });

describe("unseenCards", () => {
  it("leaves out exactly the cards the viewer holds at the start, when nothing is in play or discarded", () => {
    const view = viewFor(newMapGame(3), "lio");
    const hand = view.mine?.hand ?? [];
    expect(hand.length).toBeGreaterThan(0);
    expect([view.public.inPlay, view.public.discard, view.public.removed]).toEqual([[], [], []]);
    const unseen = unseenCards(escalationRuleset, view).map((c) => c.id);
    expect(unseen).toEqual(escalationRuleset.cards.map((c) => c.id).filter((id) => !hand.includes(id)));
  });

  it("with an unrevealed opening pick in the view's picks, leaves out the picked card and every held card, and no other", () => {
    const state = newMapGame(3);
    const decision = pendingFor(state, "lio")!;
    const value = legalAnswers(escalationRuleset, state, "lio")[0]!;
    const picked = apply(escalationRuleset, state, { decisionId: decision.id, side: "lio", value });
    if (!picked.ok) throw new Error(picked.error.code);
    const view = viewFor(picked.value.state, "lio");
    const pick = view.mine?.picks[0]?.value;
    if (pick?.kind !== "chooseCard") throw new Error("LIO has no opening pick");
    const held = new Set([...(view.mine?.hand ?? []), pick.card]);
    const unseen = unseenCards(escalationRuleset, view).map((c) => c.id);
    expect(unseen).toEqual(escalationRuleset.cards.map((c) => c.id).filter((id) => !held.has(id)));
  });
});

describe("escalationEffect", () => {
  it("is 0 and 0 for a card that does not move Escalation", () => {
    expect(escalationEffect(card([]))).toEqual({ up: 0, down: 0 });
  });

  it("adds raises and lowers separately", () => {
    expect(escalationEffect(card([up(2), up(1), up(-1)]))).toEqual({ up: 3, down: 1 });
  });

  it("takes the larger raise and the smaller lower of an if's two branches", () => {
    const branch = { op: "if", cond: {}, then: [up(2)], else: [up(1), up(-1)] } as unknown as Step;
    expect(escalationEffect(card([branch]))).toEqual({ up: 2, down: 0 });
  });

  it("counts the steps inside a forEach and a trigger", () => {
    const each = { op: "forEach", over: [], bind: "x", do: [up(1)] } as unknown as Step;
    const trig = { op: "trigger", hook: "h", do: [up(2)], duration: "turn" } as unknown as Step;
    expect(escalationEffect(card([each, trig]))).toEqual({ up: 3, down: 0 });
  });
});
