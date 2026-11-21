import { describe, expect, it } from "vitest";
import { FIRST_DECK_RULESET, cardName } from "./firstDeckRules.ts";
import { FIRST_DECK_SCENARIO } from "./firstDeckScenario.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";
import { byNumber, byText } from "./test/eraChecks.ts";

describe("the optional future cards (2025 to 2027)", () => {
  it("hold 2 LIO cards, 2 SAE cards and 2 neutral cards, with Ops 2 and 1 for the side cards and 2 and 1 for neutral", () => {
    const of = (side: string) => FUTURE_CARDS.filter((c) => c.affiliation === side).map((c) => c.ops);
    expect([of("lio").sort(byNumber), of("sae").sort(byNumber), of("neutral").sort(byNumber)]).toEqual([
      [1, 2],
      [1, 2],
      [1, 2],
    ]);
  });
  it("use the era string future, their own ids and a name and history note each", () => {
    expect(FUTURE_CARDS.map((c) => c.id).sort(byText)).toEqual(
      ["ef-lio-001", "ef-lio-002", "ef-neu-001", "ef-neu-002", "ef-sae-001", "ef-sae-002"].sort(byText),
    );
    for (const card of FUTURE_CARDS) {
      expect(card.era).toBe("future");
      expect(card.text.history.length).toBeGreaterThan(0);
      expect(cardName(card.id)).toBe(card.text.name);
    }
  });
  it("name roles, not people, in their text", () => {
    for (const card of FUTURE_CARDS) {
      const text = `${card.text.name} ${card.text.rules} ${card.text.history}`;
      expect(text).not.toMatch(/Putin|Trump|Biden|Xi |Zelensky|Assad/);
    }
  });
  it("are in the ruleset, but in no era of the base game, which stops at 2025 (docs/design/eras.md)", () => {
    expect(FIRST_DECK_SCENARIO.eras?.find((e) => e.era === "future")).toBeUndefined();
    const listed = new Set((FIRST_DECK_SCENARIO.eras ?? []).flatMap((e) => e.cards));
    for (const card of FUTURE_CARDS) expect(listed.has(card.id)).toBe(false);
    const inRuleset = new Set(FIRST_DECK_RULESET.cards.map((c) => c.id));
    for (const card of FUTURE_CARDS) expect(inRuleset.has(card.id)).toBe(true);
  });
});
