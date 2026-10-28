import { describe, expect, it } from "vitest";
import { ERA_NAMES, FIRST_DECK_CARDS, FIRST_DECK_SCENARIO } from "./firstDeck.ts";

describe("the era names players see", () => {
  it("give each era its number and years, and the future cards theirs (docs/design/eras.md)", () => {
    expect(ERA_NAMES).toEqual({
      "era-1": "Era 1 (1991–2001)",
      "era-2": "Era 2 (2001–2008)",
      "era-3": "Era 3 (2008–2025)",
      future: "Future cards (2025–2027)",
    });
  });
  it("cover every era a first-deck card or the TEST scenario names", () => {
    const joining = FIRST_DECK_SCENARIO.eras ?? [];
    expect(joining.length).toBeGreaterThan(0);
    const eras = new Set([...FIRST_DECK_CARDS.map((c) => c.era), ...joining.map((e) => e.era)]);
    for (const era of eras) expect(Object.hasOwn(ERA_NAMES, era), era).toBe(true);
  });
});
