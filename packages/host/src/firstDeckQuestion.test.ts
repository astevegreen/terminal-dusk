import { FIRST_DECK_CARDS } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { firstDeckCardQuestion } from "./firstDeck.ts";

/** True when `value` holds a yes/no `choose` step anywhere, however deeply it is nested (if, forEach, trigger). */
function asksYesNo(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(asksYesNo);
  if (typeof value !== "object" || value === null) return false;
  const step = value as { op?: unknown; decision?: { kind?: unknown } };
  if (step.op === "choose" && step.decision?.kind === "yesNo") return true;
  return Object.values(value).some(asksYesNo);
}

const yesNoCards = FIRST_DECK_CARDS.filter((card) => asksYesNo(card.effect));
const nested = [{ op: "if", then: [{ op: "trigger", do: [{ op: "choose", decision: { kind: "yesNo" } }] }] }];

describe("firstDeckCardQuestion", () => {
  it("returns the question after 'chooses: ' up to and including the first question mark", () => {
    expect(firstDeckCardQuestion("e1-lio-002")).toBe("Honour the assurances?");
  });
  it("returns undefined for an unknown card", () => {
    expect(firstDeckCardQuestion("no-such-card")).toBeUndefined();
  });
  it("returns undefined for a card whose rules text asks nothing", () => {
    const silent = FIRST_DECK_CARDS.find((card) => !card.text.rules.includes("chooses: "));
    expect(silent).toBeDefined();
    expect(firstDeckCardQuestion(silent!.id)).toBeUndefined();
  });
  it("finds the yes/no cards, including a choose step nested inside blocks", () => {
    expect(yesNoCards.length).toBeGreaterThan(0);
    expect(asksYesNo(nested)).toBe(true);
  });
  it("gives every first-deck yes/no card a question ending in '?', from rules text holding 'chooses: ' once", () => {
    for (const card of yesNoCards) {
      expect(firstDeckCardQuestion(card.id), card.id).toMatch(/^\S.*\?$/);
      expect(card.text.rules.split("chooses: ").length - 1, card.id).toBe(1);
    }
  });
});
