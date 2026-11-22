// #584 follow-up: rulesNumbers.test.ts compares the distinct numbers of each kind, so text that gave LIO's "2 fewer"
// to SAE and SAE's "1 fewer" to LIO, or swapped what happens under "if" and "otherwise", would pass there. This check
// reads every spend and every Ops swing out of the text with its side, in the order the text says them, and compares
// that list with the effect's own, so each number is tied to its side and to its branch.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

type Card = (typeof FIRST_DECK_CARDS)[number];

/**
 * Cards whose text says its spends in a different order from the data; each still has its sides checked, as a set.
 * The reason says why the order differs, so a card is never left here to hide a mistake.
 */
const ORDER_DIFFERS: Record<string, string> = {
  "e3-sae-003":
    'the text joins two markers with "or" and gives the "if LIO played this card" spend second; the data tests ' +
    "each marker in turn and asks who played the card first",
};

const SIDE: Record<string, string> = { LIO: "lio", SAE: "sae", "either side": "both" };

/**
 * What the text says, in order: "lio spends 2" for "LIO spends 2 points", "sae swing -1" for "each time SAE spends
 * points, it spends 1 fewer". An alternative ", or 3 if LIO played this card" belongs to the spend before it.
 */
function textSays(rules: string): string[] {
  const out: string[] = [];
  let last = "";
  const pattern =
    /(LIO|SAE) spends (\d+) points?|each time (LIO|SAE|either side) spends points, it spends (\d+) (more|fewer)|, or (\d+) (?:points? |if )/g;
  for (const m of rules.matchAll(pattern)) {
    if (m[1] !== undefined) {
      last = SIDE[m[1]]!;
      out.push(`${last} spends ${m[2]}`);
    } else if (m[3] !== undefined) {
      out.push(`${SIDE[m[3]]} swing ${m[5] === "fewer" ? -Number(m[4]) : Number(m[4])}`);
    } else out.push(`${last} spends ${m[6]}`);
  }
  return out;
}

/**
 * What the effect does, in document order, in the same words as `textSays`. An "if" whose two branches spend the
 * same counts once, as the text says it once ("If it is, … LIO spends 2 points" under either threshold, e3-lio-001).
 */
function effectSays(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(effectSays);
  if (value === null || typeof value !== "object") return [];
  const step = value as Record<string, unknown>;
  if (step.op === "spendPoints") return [`${String(step.side)} spends ${String(step.amount)}`];
  if (step.hook === "opsValue") return [`${String(step.side)} swing ${String(step.add)}`];
  if (step.op === "if") {
    const [then, otherwise] = [effectSays(step.then), effectSays(step.else)];
    return JSON.stringify(then) === JSON.stringify(otherwise) ? then : [...then, ...otherwise];
  }
  return Object.values(step).flatMap(effectSays);
}

const asSet = (said: string[]): string[] => [...new Set(said)].sort();

/** The check itself: the same list in the same order, or for a card in ORDER_DIFFERS the same set. */
function agrees(card: Card, rules: string = card.text.rules): boolean {
  const [text, effect] = [textSays(rules), effectSays(card.effect)];
  return card.id in ORDER_DIFFERS
    ? JSON.stringify(asSet(text)) === JSON.stringify(asSet(effect))
    : JSON.stringify(text) === JSON.stringify(effect);
}

const card = (id: string): Card => FIRST_DECK_CARDS.find((c) => c.id === id)!;
const swapSides = (rules: string): string =>
  rules.replaceAll(/\b(LIO|SAE)\b/g, (side) => (side === "LIO" ? "SAE" : "LIO"));

describe("each card's rules text gives each spend and Ops swing to the right side, in the right branch", () => {
  it("every card's text and effect agree", () => {
    let checked = 0;
    for (const c of FIRST_DECK_CARDS) {
      const said = effectSays(c.effect);
      if (c.id in ORDER_DIFFERS) expect(asSet(textSays(c.text.rules)), c.id).toEqual(asSet(said));
      else expect(textSays(c.text.rules), `${c.id}: ${c.text.rules}`).toEqual(said);
      if (said.length > 0) checked++;
    }
    // Most cards spend or swing; a pattern that stops matching would leave far fewer checked.
    expect(checked).toBeGreaterThan(80);
  });

  it("fails a card whose text gives LIO's swing to SAE and SAE's to LIO", () => {
    // e1-neu-001: "LIO … spends 2 fewer and … SAE … spends 1 fewer"; the distinct-number check passes the swap.
    expect(agrees(card("e1-neu-001"), swapSides(card("e1-neu-001").text.rules))).toBe(false);
  });

  it("fails a card whose text swaps what happens under 'if' and 'otherwise'", () => {
    // e1-lio-002: "If yes, … SAE spends 1 point …; if no, … LIO spends 1 point".
    const rules = card("e1-lio-002")
      .text.rules.replace("SAE spends 1 point", "XX")
      .replace("LIO spends 1 point", "SAE spends 1 point");
    expect(agrees(card("e1-lio-002"), rules.replace("XX", "LIO spends 1 point"))).toBe(false);
  });

  it("fails a card whose text gives a spend to the wrong side, even when its order is excused", () => {
    expect(agrees(card("e3-sae-003"), swapSides(card("e3-sae-003").text.rules))).toBe(false);
  });

  it("excuses only cards that exist and whose order really differs", () => {
    for (const id of Object.keys(ORDER_DIFFERS)) {
      const c = card(id);
      expect(c, id).toBeDefined();
      expect(JSON.stringify(textSays(c.text.rules)), id).not.toEqual(JSON.stringify(effectSays(c.effect)));
    }
  });
});
