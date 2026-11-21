// #584: every number in a card's rules text matches the card's effect data. The rewording tests beside this file
// (rulesWording.test.ts) check the wording's form; this one reads the numbers out of the text (points spent, Ops
// swings and their floor, Contingency thresholds, Escalation moves, cards discarded) and compares them with the
// numbers in the effect, so a card whose text and data disagree fails here. It compares the distinct numbers of each
// kind, not how often each appears: the text states a spend once where the data repeats it in two branches (e3-lio-001
// spends 2 or 1 under either threshold), and one "never below 1" covers both sides' swings (e1-neu-001).
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

type Card = (typeof FIRST_DECK_CARDS)[number];
type Step = Record<string, unknown>;

/** Cards left out of a check because their text and data disagree; each is a design question on #584. */
const DISAGREE: Record<string, readonly string[]> = {};

/** Every object inside `value` (a card's effect), in document order. */
function steps(value: unknown, out: Step[] = []): Step[] {
  if (Array.isArray(value)) for (const v of value) steps(v, out);
  else if (value !== null && typeof value === "object") {
    out.push(value as Step);
    for (const v of Object.values(value)) steps(v, out);
  }
  return out;
}

/** The distinct numbers in `found`, smallest first. */
const distinct = (found: number[]): number[] => [...new Set(found)].sort((a, b) => a - b);

/** The distinct numbers a pattern's first group captures in `text`, each signed by `sign` of the whole match. */
const said = (text: string, pattern: RegExp, sign: (match: string) => number = () => 1): number[] =>
  distinct([...text.matchAll(pattern)].map((m) => sign(m[0]) * Number(m[1])));

/** The distinct numbers `pick` finds in the effect's steps. */
const data = (card: Card, pick: (step: Step) => unknown): number[] =>
  distinct(
    steps(card.effect)
      .map(pick)
      .filter((n): n is number => typeof n === "number"),
  );

const isSwing = (step: Step): boolean => step.hook === "opsValue";

/** Each check: what it reads from the text, and what it reads from the data. */
const CHECKS: { name: string; text: (rules: string) => number[]; effect: (card: Card) => number[] }[] = [
  {
    name: "points spent",
    // "spends 2 points on one action", and the alternative in "…, or 3 if LIO played this card".
    text: (r) => distinct([...said(r, /spends (\d+) points?/g), ...said(r, /, or (\d+) (?:points? |if )/g)]),
    effect: (card) => data(card, (s) => (s.op === "spendPoints" ? s.amount : undefined)),
  },
  {
    name: "Ops swings",
    text: (r) => said(r, /spends (\d+) (?:more|fewer)/g, (m) => (m.endsWith("fewer") ? -1 : 1)),
    effect: (card) => data(card, (s) => (isSwing(s) ? s.add : undefined)),
  },
  {
    name: "Ops swing floors",
    text: (r) => said(r, /below (\d+)/g),
    effect: (card) => data(card, (s) => (isSwing(s) ? s.min : undefined)),
  },
  {
    name: "Contingency thresholds of N or more",
    text: (r) => said(r, /(\d+) or more/g),
    effect: (card) => data(card, (s) => (s.op === "atLeast" ? s.value : undefined)),
  },
  {
    name: "Contingency thresholds of N or less",
    text: (r) => said(r, /(\d+) or less/g),
    effect: (card) => data(card, (s) => (s.op === "atMost" ? s.value : undefined)),
  },
  {
    name: "Escalation moves",
    text: (r) => said(r, /(?:raise|lower) escalation by (\d+)/gi, (m) => (/^lower/i.test(m) ? -1 : 1)),
    effect: (card) => data(card, (s) => (s.op === "escalate" ? s.by : undefined)),
  },
  {
    name: "cards discarded",
    text: (r) => said(r, /discards (\d+) cards?/g),
    effect: (card) => data(card, (s) => (s.op === "discardFromHand" ? s.count : undefined)),
  },
];

describe("each card's rules text states the numbers its effect uses", () => {
  it.each(CHECKS.map((check) => [check.name, check] as const))("%s", (name, check) => {
    let checked = 0;
    for (const card of FIRST_DECK_CARDS) {
      if (DISAGREE[card.id]?.includes(name) === true) continue;
      expect(check.text(card.text.rules), `${card.id}: ${card.text.rules}`).toEqual(check.effect(card));
      if (check.effect(card).length > 0) checked++;
    }
    // Each check reads a number on at least one card, so a pattern that stops matching fails here.
    expect(checked, name).toBeGreaterThan(0);
  });

  it.each(CHECKS.map((check) => [check.name, check] as const))(
    "%s: a card whose text says a different number fails the check",
    (_name, check) => {
      const card = FIRST_DECK_CARDS.find((c) => check.effect(c).length > 0)!;
      const wrong = card.text.rules.replaceAll(/\d+/g, (n) => String(Number(n) + 10));
      expect(check.text(wrong), card.id).not.toEqual(check.effect(card));
    },
  );

  it("leaves out only cards that exist, and only from checks that exist", () => {
    const ids = new Set(FIRST_DECK_CARDS.map((card) => card.id));
    const names = new Set(CHECKS.map((check) => check.name));
    for (const [id, left] of Object.entries(DISAGREE)) {
      expect(ids.has(id), id).toBe(true);
      for (const name of left) expect(names.has(name), `${id}: ${name}`).toBe(true);
    }
  });
});
