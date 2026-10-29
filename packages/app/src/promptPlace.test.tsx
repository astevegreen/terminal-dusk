// Where a prompt draws its choices (L6, #486): the choices that use a card in the hand go on that card when it is
// lifted from the hand strip, and the decision's own region keeps the question and every other choice.
import { createElement } from "react";
import type { AnswerValue, Decision, DecisionOptions } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import type { PromptPlace, PromptProps } from "./decisionPrompts.tsx";
import { TAP_A_CARD } from "./promptChoices.tsx";
import { buttonsOf } from "./testMode/promptTree.ts";

const play: DecisionOptions = { from: "hand", uses: { own: ["event", "points"], rival: ["points"], neutral: [] } };
const decision = (kind: Decision["kind"], options: DecisionOptions): Decision => ({
  id: "d1",
  side: "lio",
  kind,
  options,
});

const propsFor = (d: Decision, place: PromptPlace | undefined, sent?: AnswerValue[]): PromptProps => ({
  decision: d,
  hand: ["a", "b", "c"],
  known: ["x", "y"],
  label: (card) => `Card ${card}`,
  affiliation: (card) => (card === "b" ? "sae" : "lio"),
  stack: [],
  question: () => undefined,
  ...(sent ? { onAnswer: (v: AnswerValue) => sent.push(v) } : {}),
  ...(place === undefined ? {} : { place }),
});

/** The button texts a prompt draws in `place`, and the answers they send when each is pressed. */
function drawn(d: Decision, place: PromptPlace | undefined) {
  const sent: AnswerValue[] = [];
  const buttons = buttonsOf(createElement(decisionPrompts[d.kind], propsFor(d, place, sent)));
  for (const b of buttons) b.click();
  return { texts: buttons.map((b) => b.text), sent };
}
const html = (d: Decision, place: PromptPlace | undefined, answerable = true): string =>
  renderToString(createElement(decisionPrompts[d.kind], propsFor(d, place, answerable ? [] : undefined)));

describe("a play (playCardAs)", () => {
  const d = decision("playCardAs", play);
  it("puts each card's play buttons on that card, with today's wording", () => {
    expect(drawn(d, { card: "a" })).toEqual({
      texts: ["Card a: event", "Card a: points"],
      sent: [
        { kind: "playCardAs", card: "a", as: "event" },
        { kind: "playCardAs", card: "a", as: "points" },
      ],
    });
    expect(drawn(d, { card: "b" }).texts).toEqual(["Card b: points"]);
  });
  it("keeps the question in the decision's region with a hint to tap a card, and no card buttons", () => {
    const banner = html(d, "banner");
    expect(banner).toContain("LIO: play a card for its event or its points");
    expect(banner).toContain(TAP_A_CARD);
    expect(drawn(d, "banner").texts).toEqual([]);
  });
  it("names the lifted card's buttons by the question in the decision's region, so the words show once", () => {
    const card = html(d, { card: "a" });
    expect(card).toContain('aria-labelledby="decision-d1-question"');
    expect(card).not.toContain("play a card for its event");
  });
  it("draws nothing on a card that has no play", () => {
    const none = decision("playCardAs", { from: "hand", uses: { own: [], rival: ["points"], neutral: [] } });
    expect(html(none, { card: "a" })).toBe("");
  });
  it("draws every choice in one place when no place is given, as before the strip", () => {
    expect(drawn(d, undefined).texts).toEqual([
      "Card a: event",
      "Card a: points",
      "Card b: points",
      "Card c: event",
      "Card c: points",
    ]);
  });
});

describe("the other card decisions", () => {
  it("extraPlay: the plays go on the cards and Pass stays in the decision's region", () => {
    const d = decision("extraPlay", play);
    expect(drawn(d, "banner").texts).toEqual(["Pass"]);
    expect(drawn(d, { card: "c" }).texts).toEqual(["Card c: event", "Card c: points"]);
  });
  it("chooseCard: each card's pick is on that card", () => {
    const d = decision("chooseCard", { from: "hand" });
    expect(drawn(d, { card: "b" })).toEqual({ texts: ["Card b"], sent: [{ kind: "chooseCard", card: "b" }] });
    expect(drawn(d, "banner").texts).toEqual([]);
    expect(html(d, "banner")).toContain("LIO: pick an opening card");
  });
  it("discardCards from the hand: each set is on every card in it", () => {
    const d = decision("discardCards", { from: "hand", count: 2 });
    expect(drawn(d, { card: "a" }).texts).toEqual(["Discard Card a, Card b", "Discard Card a, Card c"]);
    expect(drawn(d, { card: "c" })).toEqual({
      texts: ["Discard Card a, Card c", "Discard Card b, Card c"],
      sent: [
        { kind: "discardCards", cards: ["a", "c"] },
        { kind: "discardCards", cards: ["b", "c"] },
      ],
    });
    expect(drawn(d, "banner").texts).toEqual([]);
  });
  it("discardCards from the rival's hand: those cards are not in the strip, so the choices stay in the region", () => {
    const d = decision("discardCards", { from: "rivalHand", count: 1 });
    expect(drawn(d, "banner").texts).toEqual(["Discard Card x", "Discard Card y"]);
    expect(html(d, "banner")).not.toContain(TAP_A_CARD);
    expect(html(d, { card: "a" })).toBe("");
  });
});

describe("decisions that use no card", () => {
  it.each([
    [decision("yesNo", {}), ["Yes", "No"]],
    [decision("rivalEventOrder", {}), ["Before the points", "After the points"]],
    [decision("placeInfluence", { points: 2, countries: ["c1"] }), ["Place in c1"]],
  ])("%#: keep every choice in the decision's region, with no hint, and draw nothing on a card", (d, texts) => {
    expect(drawn(d, "banner").texts).toEqual(texts);
    expect(html(d, "banner")).not.toContain(TAP_A_CARD);
    expect(html(d, { card: "a" })).toBe("");
  });
});

describe("a read-only prompt", () => {
  it("lists every choice as text in the decision's region and nothing on a card, as there is nothing to tap", () => {
    const d = decision("playCardAs", play);
    const banner = html(d, "banner", false);
    expect(banner).toContain("<li>Card a: event</li>");
    expect(banner).not.toContain(TAP_A_CARD);
    expect(html(d, { card: "a" }, false)).toBe("");
  });
});
