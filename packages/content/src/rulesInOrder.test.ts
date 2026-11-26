// #584 follow-up (#606, then the numbers' follow-up): rulesNumbers.test.ts compares the distinct numbers of each
// kind, so text that gave LIO's "2 fewer" to SAE, moved a discard to the other side, or swapped what happens under
// "if" and "otherwise" would pass there. This check reads the text's numbers with their sides, in the order the text
// says them, and compares that list with the effect's own, so each number is tied to its side and its branch:
// points spent, Ops swings with their floors, Contingency draws and their thresholds, Escalation moves and discards.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

type Card = (typeof FIRST_DECK_CARDS)[number];
type Step = Record<string, unknown>;

const SIDE: Record<string, string> = { LIO: "lio", SAE: "sae", "either side": "both" };
const DECK: Record<string, string> = { "LIO's": "lio", "SAE's": "sae", "the side that played this card": "player" };

const PATTERN = new RegExp(
  [
    /each time (LIO|SAE|either side) spends points, it spends (\d+) (more|fewer)/,
    /(LIO|SAE) spends (\d+) points?/,
    /, or (\d+) (?:points? [a-z ]*?)?if (LIO|SAE) played this card/,
    /never below (\d+)/,
    /draw from (?:(LIO's|SAE's) Contingency deck|the Contingency deck of (the side that played this card))/,
    /(\d+) or (more|less)/,
    /(raise|lower) escalation by (\d+)/,
    /(LIO|SAE) discards (\d+) cards?/,
    /[.;]/,
  ]
    .map((p) => p.source)
    .join("|"),
  "gi",
);

/**
 * What the text says, in order. A "never below N" belongs to every Ops swing before it in the same clause (one floor
 * covers both swings in e1-neu-001). The alternative ", or 3 if LIO played this card" goes before the spend it
 * qualifies, as the data asks "did LIO play it?" first; ", or 1 … if SAE played this card" goes after.
 */
function textSays(rules: string): string[] {
  const out: { said: string }[] = [];
  let unfloored: { said: string }[] = [];
  let lastSpend = -1;
  for (const m of rules.matchAll(PATTERN)) {
    const g = m.slice(1);
    if (g[0] !== undefined) {
      const swing = { said: `${SIDE[g[0]]} swing ${g[2] === "fewer" ? -Number(g[1]) : Number(g[1])}` };
      out.push(swing);
      unfloored.push(swing);
    } else if (g[3] !== undefined) {
      lastSpend = out.push({ said: `${SIDE[g[3]]} spends ${g[4]}` }) - 1;
    } else if (g[5] !== undefined) {
      const side = out[lastSpend]!.said.split(" ")[0];
      const alternative = { said: `${side} spends ${g[5]}` };
      if (g[6] === "LIO") out.splice(lastSpend, 0, alternative);
      else out.push(alternative);
    } else if (g[7] !== undefined) {
      for (const swing of unfloored) swing.said += ` below ${g[7]}`;
      unfloored = [];
    } else if (g[8] !== undefined || g[9] !== undefined) {
      out.push({ said: `draw ${DECK[g[8] ?? g[9]!]}` });
    } else if (g[10] !== undefined) {
      out.push({ said: `at ${g[11] === "more" ? "least" : "most"} ${g[10]}` });
    } else if (g[12] !== undefined) {
      out.push({ said: `escalation ${/^lower/i.test(g[12]) ? -Number(g[13]) : Number(g[13])}` });
    } else if (g[14] !== undefined) {
      out.push({ said: `${SIDE[g[14]]} discards ${g[15]}` });
    } else unfloored = [];
  }
  return out.map((o) => o.said);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const only = (branch: unknown): Step | null =>
  Array.isArray(branch) && branch.length === 1 && (branch[0] as Step).op === "if" ? (branch[0] as Step) : null;

/** What a condition says: its thresholds ("at least 4"); markers and who played the card say no number. */
function condSays(cond: unknown): string[] {
  if (cond === null || typeof cond !== "object") return [];
  const c = cond as Step;
  if (c.op === "atLeast") return [`at least ${String(c.value)}`];
  if (c.op === "atMost") return [`at most ${String(c.value)}`];
  return Object.values(c).flatMap(condSays);
}

/**
 * What an `if` says, with the two shapes the text writes more briefly than the data:
 * - "If A or B (or both), X; otherwise, Y" is "if A, X; otherwise if B, X; otherwise, Y" (e3-sae-003): pair them.
 * - "If A, the result needs to be 2 or more; otherwise, 3 or more. If it is, X; otherwise, Y" is "if A, (if 2 or
 *   more, X; otherwise, Y); otherwise, (if 3 or more, X; otherwise, Y)" (e3-lio-001): both thresholds, then X and Y.
 * Every other `if` says its condition, then its branch, then its otherwise, each in full: an `if` whose two branches
 * do the same still needs the text to say both.
 */
function ifSays(step: Step): string[] {
  const inner = only(step.else);
  if (inner !== null && same(inner.then, step.then)) {
    return ifSays({ ...step, cond: [step.cond, inner.cond], else: inner.else });
  }
  const [a, b] = [only(step.then), only(step.else)];
  if (a !== null && b !== null && same(a.then, b.then) && same(a.else, b.else)) {
    return [...condSays(a.cond), ...condSays(b.cond), ...effectSays(a.then), ...effectSays(a.else)];
  }
  return [...condSays(step.cond), ...effectSays(step.then), ...effectSays(step.else)];
}

/** What the effect does, in document order, in the same words as `textSays`. */
function effectSays(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(effectSays);
  if (value === null || typeof value !== "object") return [];
  const step = value as Step;
  const side = String(step.side);
  if (step.op === "spendPoints") return [`${side} spends ${String(step.amount)}`];
  if (step.hook === "opsValue") {
    return [`${side} swing ${String(step.add)}${step.min === undefined ? "" : ` below ${String(step.min)}`}`];
  }
  if (step.op === "drawContingency") return [`draw ${side}`];
  if (step.op === "escalate") return [`escalation ${String(step.by)}`];
  if (step.op === "discardFromHand") return [`${side} discards ${String(step.count)}`];
  if (step.op === "if") return ifSays(step);
  return Object.values(step).flatMap(effectSays);
}

/** The check itself: the same list in the same order. */
const agrees = (card: Card, rules: string = card.text.rules): boolean => same(textSays(rules), effectSays(card.effect));

const card = (id: string): Card => FIRST_DECK_CARDS.find((c) => c.id === id)!;
const swapSides = (rules: string): string =>
  rules.replaceAll(/\b(LIO|SAE)\b/g, (side) => (side === "LIO" ? "SAE" : "LIO"));
/** `id`'s text with `from` replaced by `to`, checked to be there, so a reworded card fails loudly here. */
function edited(id: string, from: string, to: string, rules = card(id).text.rules): string {
  expect(rules, id).toContain(from);
  return rules.replace(from, to);
}
/** What kind of number a said item is: "lio swing -1 below 1" is a swing, "draw player" a draw. */
const kind = (said: string): string =>
  said
    .replace(/^(lio|sae|both) /, "")
    .replace(/ (lio|sae|player)$/, "")
    .replace(/ -?\d+.*$/, "");

describe("each card's rules text gives each number to the right side, in the right branch", () => {
  it("every card's text and effect agree, in order", () => {
    const kinds = new Set<string>();
    let checked = 0;
    for (const c of FIRST_DECK_CARDS) {
      const said = effectSays(c.effect);
      expect(textSays(c.text.rules), `${c.id}: ${c.text.rules}`).toEqual(said);
      for (const s of said) kinds.add(kind(s));
      if (said.length > 0) checked++;
    }
    // Most cards say a number, and every kind turns up; a pattern that stopped matching would leave fewer.
    expect(checked).toBeGreaterThan(80);
    expect([...kinds].sort()).toEqual(["at least", "at most", "discards", "draw", "escalation", "spends", "swing"]);
  });

  it("fails a card whose text gives LIO's swing to SAE and SAE's to LIO", () => {
    // e1-neu-001: "LIO … spends 2 fewer and … SAE … spends 1 fewer"; the distinct-number check passes the swap.
    expect(agrees(card("e1-neu-001"), swapSides(card("e1-neu-001").text.rules))).toBe(false);
  });

  it("fails a card whose text swaps what happens under 'if' and 'otherwise'", () => {
    // e1-lio-002: "If yes, … SAE spends 1 point …; if no, … LIO spends 1 point".
    const rules = edited("e1-lio-002", "SAE spends 1 point", "XX").replace("LIO spends 1 point", "SAE spends 1 point");
    expect(agrees(card("e1-lio-002"), rules.replace("XX", "LIO spends 1 point"))).toBe(false);
  });

  it("fails e3-sae-003 with its 'if marker' branches swapped, or a spend on the wrong side", () => {
    const swapped = edited("e3-sae-003", "4 points on one action, or 3", "XX");
    const back = edited("e3-sae-003", "3 points on one action, or 2", "4 points on one action, or 3", swapped);
    expect(agrees(card("e3-sae-003"), back.replace("XX", "3 points on one action, or 2"))).toBe(false);
    // "or 3 if SAE played this card" would make the 3 SAE's own play, not LIO's.
    expect(agrees(card("e3-sae-003"), edited("e3-sae-003", "or 3 if LIO played", "or 3 if SAE played"))).toBe(false);
    expect(agrees(card("e3-sae-003"), swapSides(card("e3-sae-003").text.rules))).toBe(false);
  });

  it("fails a card whose text swaps its two thresholds between 'if' and 'otherwise'", () => {
    // e3-lio-001: "the result needs to be 2 or more; otherwise, 3 or more"; the distinct-number check passes the swap.
    const rules = edited("e3-lio-001", "2 or more; otherwise, 3 or more", "3 or more; otherwise, 2 or more");
    expect(agrees(card("e3-lio-001"), rules)).toBe(false);
  });

  it("fails a card whose text draws from the wrong deck, or draws in the wrong branch", () => {
    const wrongDeck = edited("e1-sae-009", "SAE's Contingency deck", "LIO's Contingency deck");
    expect(agrees(card("e1-sae-009"), wrongDeck)).toBe(false);
    // e1-lio-004: the draw and its "4 or more" belong under "If yes", not "if no".
    const yes = /If yes, (\(.*\)); if no, (LIO spends 1 point on actions)/;
    const rules = card("e1-lio-004").text.rules;
    expect(rules).toMatch(yes);
    expect(agrees(card("e1-lio-004"), rules.replace(yes, "If yes, $2; if no, $1"))).toBe(false);
  });

  it("fails a card whose text gives a discard to the wrong side", () => {
    expect(agrees(card("e3-lio-003"), edited("e3-lio-003", "SAE discards 1 card", "LIO discards 1 card"))).toBe(false);
  });

  it("fails a card whose text moves an Escalation move out of its place", () => {
    // e1-lio-002 lowers Escalation after the choice, not before LIO's first spend.
    const rules = edited("e1-lio-002", " Lower Escalation by 1.", "");
    expect(agrees(card("e1-lio-002"), `Lower Escalation by 1. ${rules}`)).toBe(false);
  });

  it("fails a card whose text leaves the floor off one of two swings in different clauses", () => {
    // e3-neu-008: LIO's swing and SAE's each say "never below 1"; the later floor does not cover the first swing.
    const rules = edited("e3-neu-008", "it spends 1 fewer, never below 1. SAE", "it spends 1 fewer. SAE");
    expect(agrees(card("e3-neu-008"), rules)).toBe(false);
  });

  it("an 'if' whose branches do the same still needs the text to say both", () => {
    // e1-lio-010 with LIO's 1 in both branches: text naming that spend in one branch only fails.
    const both = { op: "spendPoints", side: "lio", amount: 1 };
    const effect = (card("e1-lio-010").effect as Step[]).map((s) =>
      s.op === "if" ? { ...s, then: [both], else: [both] } : s,
    );
    const changed = { ...card("e1-lio-010"), effect } as Card;
    const once = edited("e1-lio-010", "; otherwise, SAE spends 1 point on actions", "");
    expect(agrees(changed, once)).toBe(false);
    expect(agrees(changed, once.replace(/\.$/, "; otherwise, LIO spends 1 point on actions."))).toBe(true);
  });
});
