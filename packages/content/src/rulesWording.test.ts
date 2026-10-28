// #418: the reworded card rules text (docs/proposals/card-rewording/, approved by the owner on 28 Oct). Every card's
// text says that points go to an action, states each Escalation move, and uses the clearer Ops-swing wording.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

const rules = (card: (typeof FIRST_DECK_CARDS)[number]): string => card.text.rules;
const effectJson = (card: (typeof FIRST_DECK_CARDS)[number]): string => JSON.stringify(card.effect);

describe("the cards' rules text after the rewording", () => {
  it("covers all 96 cards of the first deck", () => {
    expect(FIRST_DECK_CARDS).toHaveLength(96);
  });

  it("says where every spent point goes: 'on actions' for 1 point, 'on one action' for 2 or more", () => {
    for (const card of FIRST_DECK_CARDS) {
      const spends = [...rules(card).matchAll(/spends (\d+) points?(.{0,14})/g)];
      for (const [whole, amount, after] of spends) {
        const expected = Number(amount) >= 2 ? " on one action" : " on actions";
        expect(after?.startsWith(expected), `${card.id}: "${whole}"`).toBe(true);
      }
    }
  });

  it("a card with a spendPoints step says so, and a card without one does not", () => {
    for (const card of FIRST_DECK_CARDS) {
      expect(/spends \d+ points?/.test(rules(card)), card.id).toBe(effectJson(card).includes('"op":"spendPoints"'));
    }
  });

  it("states each Escalation move: raise for +1, lower for -1, and nothing for a card that does not move it", () => {
    for (const card of FIRST_DECK_CARDS) {
      const by = /"op":"escalate","by":(-?\d+)/.exec(effectJson(card))?.[1];
      const text = rules(card).toLowerCase();
      if (by === undefined) expect(text.includes("escalation"), card.id).toBe(false);
      else
        expect(
          text.includes(`${Number(by) > 0 ? "raise" : "lower"} escalation by ${Math.abs(Number(by))}`),
          card.id,
        ).toBe(true);
    }
  });

  it("an Ops swing reads 'each time X spends points, it spends N more/fewer', never 'points spent by X count'", () => {
    for (const card of FIRST_DECK_CARDS) {
      expect(rules(card), card.id).not.toMatch(/points spent by/);
      expect(rules(card), card.id).not.toMatch(/count \d+ (more|less)/);
      const swing = effectJson(card).includes('"hook":"opsValue"');
      expect(/each time .+ spends points, it spends \d+ (more|fewer)/.test(rules(card)), card.id).toBe(swing);
    }
  });
});
